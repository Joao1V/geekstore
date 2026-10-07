// Gera os lotes para a faxina "pelo site do Claude" (sem gastar crédito de API). Cada lote é um .md que
// você anexa numa conversa; a resposta vai para um .txt e o ai:import lê.
//
//   pnpm --filter api ai:export --only noisy --per-file 250
//   pnpm --filter api ai:export --only noisy --single      (um arquivo só, resposta em partes)
//   pnpm --filter api ai:import
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import { buildWebBatch } from '../modules/ai/web-batches';

const DEFAULT_PER_FILE = 250;
// Código de fabricante/ERP no nome: "#1452", "MC49222HP", "CS2002".
const CODE_LIKE = /(#\s*[A-Z0-9-]{2,}|\b[A-Z]{1,4}\d{3,}[A-Z0-9-]*\b)/;

async function main() {
  const { values } = parseArgs({
    options: {
      only: { type: 'string', default: 'noisy' },
      'per-file': { type: 'string', default: String(DEFAULT_PER_FILE) },
      single: { type: 'boolean', default: false },
      out: { type: 'string', default: '../../.temp' },
    },
  });
  const dir = resolve(values.out ?? '../../.temp', 'ia-web');
  mkdirSync(resolve(dir, 'respostas'), { recursive: true });
  const resultsFile = resolve(values.out ?? '../../.temp', 'ia-resultados.jsonl');
  const done = new Set<string>(
    existsSync(resultsFile)
      ? readFileSync(resultsFile, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => (JSON.parse(line) as { id: string }).id)
      : []
  );
  const franchises = await prisma.collection.findMany({
    where: { kind: 'franchise' },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  const all = await prisma.$queryRaw<{ product_id: string; name: string; category: string }[]>`
    SELECT p.product_id::text AS product_id, p.name, c.name AS category
    FROM product p JOIN category c ON c.category_id = p.category_id
    WHERE p.status <> 'archived' ORDER BY p.created_at, p.product_id`;
  const pending = all
    .filter((row) => !done.has(row.product_id))
    .filter((row) => values.only === 'all' || CODE_LIKE.test(row.name));
  const perFile = values.single
    ? Math.max(1, pending.length)
    : Math.max(20, Number(values['per-file']) || DEFAULT_PER_FILE);

  let count = 0;
  for (let start = 0; start < pending.length; start += perFile) {
    count += 1;
    const items = pending
      .slice(start, start + perFile)
      .map((row) => ({ id: row.product_id, name: row.name, category: row.category }));
    const label = values.single ? 'todos' : String(count).padStart(3, '0');
    writeFileSync(
      resolve(dir, `lote-${label}.md`),
      buildWebBatch(items, franchises, values.single ? 'todos' : count)
    );
    writeFileSync(resolve(dir, `lote-${label}.map.json`), JSON.stringify(items));
  }
  console.log(`${pending.length} produtos em ${count} lotes (${perFile} por arquivo): ${dir}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
