// Lê as respostas coladas em .temp/ia-web/respostas/lote-NNN.txt e grava as sugestões em
// .temp/ia-resultados.jsonl (o mesmo arquivo da faxina pela API). Depois: pnpm --filter api ai:apply.
import { appendFileSync, existsSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import type { CleanupInput } from '../modules/ai/name-cleanup';
import { parseWebAnswer } from '../modules/ai/web-batches';

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string', default: '../../.temp' } } });
  const root = resolve(values.out ?? '../../.temp');
  const dir = resolve(root, 'ia-web');
  const answers = resolve(dir, 'respostas');
  const franchises = await prisma.collection.findMany({
    where: { kind: 'franchise' },
    select: { slug: true, name: true },
  });

  const files = existsSync(answers)
    ? readdirSync(answers).filter((name) => /^lote-\d+.*\.txt$/.test(name))
    : [];
  let total = 0;
  for (const file of files.sort()) {
    const label = /^lote-(\d+)/.exec(file)?.[1] ?? '';
    const mapPath = resolve(dir, `lote-${label}.map.json`);
    if (!existsSync(mapPath)) {
      console.log(`${file}: sem o lote-${label}.map.json, ignorado.`);
      continue;
    }
    const items = JSON.parse(readFileSync(mapPath, 'utf8')) as CleanupInput[];
    const { suggestions, unreadable } = parseWebAnswer(
      readFileSync(resolve(answers, file), 'utf8'),
      items,
      franchises
    );
    appendFileSync(
      resolve(root, 'ia-resultados.jsonl'),
      suggestions.map((row) => `${JSON.stringify(row)}\n`).join('')
    );
    renameSync(resolve(answers, file), resolve(answers, file.replace(/\.txt$/, '.lido')));
    total += suggestions.length;
    console.log(
      `${file}: ${suggestions.length} de ${items.length} aceitas, ${unreadable} linhas ilegíveis, ` +
        `${items.length - suggestions.length - unreadable} recusadas (número inventado, confiança ou código inválido).`
    );
  }
  console.log(`Total importado: ${total}. Agora rode: pnpm --filter api ai:apply`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
