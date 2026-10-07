// Faxina de nomes e franquias com IA em TODO o catálogo. Só LÊ o banco e grava um arquivo de
// resultados (.temp/ia-resultados.jsonl); quem altera o banco é o ai:apply. Dá para parar e retomar:
// o que já está no arquivo não é perguntado de novo.
//
//   pnpm --filter api ai:cleanup --model claude-sonnet-5-5 --concurrency 6 [--limit 500]
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import { createCompleter } from '../core/ai/complete';
import { cleanupBatches } from '../modules/ai/name-cleanup';

const MAX_TOKENS = 4_000;
const DEFAULT_CONCURRENCY = 6;

type Candidate = { product_id: string; name: string; category: string };

async function main() {
  const { values } = parseArgs({
    options: {
      model: { type: 'string' },
      concurrency: { type: 'string', default: String(DEFAULT_CONCURRENCY) },
      limit: { type: 'string' },
      out: { type: 'string', default: '../../.temp' },
    },
  });
  const out = resolve(values.out ?? '../../.temp');
  mkdirSync(out, { recursive: true });
  const file = resolve(out, 'ia-resultados.jsonl');
  const done = new Set<string>(
    existsSync(file)
      ? readFileSync(file, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => (JSON.parse(line) as { id: string }).id)
      : []
  );
  const complete = createCompleter(MAX_TOKENS, values.model);

  const franchises = await prisma.collection.findMany({
    where: { kind: 'franchise' },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  const all = await prisma.$queryRaw<Candidate[]>`
    SELECT p.product_id::text AS product_id, p.name, c.name AS category
    FROM product p JOIN category c ON c.category_id = p.category_id
    WHERE p.status <> 'archived'
    ORDER BY p.created_at, p.product_id`;
  const pending = all.filter((row) => !done.has(row.product_id));
  const limit = values.limit ? Number(values.limit) : pending.length;
  const items = pending
    .slice(0, limit)
    .map((row) => ({ id: row.product_id, name: row.name, category: row.category }));
  console.log(
    `${all.length} produtos, ${done.size} já feitos, ${items.length} agora. Modelo: ${values.model ?? 'padrão do ambiente'}.`
  );

  let written = 0;
  const startedAt = Date.now();
  const { skipped } = await cleanupBatches(items, franchises, complete, {
    concurrency: Number(values.concurrency) || DEFAULT_CONCURRENCY,
    onBatch: (rows) => {
      appendFileSync(file, rows.map((row) => `${JSON.stringify(row)}\n`).join(''));
      written += rows.length;
      const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
      console.log(`  ${written}/${items.length} (${minutes} min)`);
    },
  });
  console.log(
    `Pronto: ${written} sugestões, ${skipped} pulados (rode de novo para tentar os pulados).`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
