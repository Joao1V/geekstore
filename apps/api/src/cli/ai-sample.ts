// Piloto da faxina com IA: pega uma amostra de produtos (sem franquia ou com cara de código de
// fabricante no nome), pede à IA o nome limpo e a franquia, e grava um arquivo para você conferir.
// NÃO escreve no banco. Uso:
//
//   pnpm --filter api ai:sample --sample 200 --out ../../.temp
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import { createCompleter } from '../core/ai/complete';
import { cleanupBatches } from '../modules/ai/name-cleanup';

const DEFAULT_SAMPLE = 200;
const MAX_SAMPLE = 2_000;
const MAX_TOKENS = 4_000;
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

async function main() {
  const { values } = parseArgs({
    options: {
      sample: { type: 'string', default: String(DEFAULT_SAMPLE) },
      out: { type: 'string', default: '../../.temp' },
    },
  });
  const sample = Math.min(MAX_SAMPLE, Math.max(1, Number(values.sample) || DEFAULT_SAMPLE));
  const complete = createCompleter(MAX_TOKENS);

  const franchises = await prisma.collection.findMany({
    where: { kind: 'franchise' },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  const picked = await prisma.$queryRaw<{ product_id: string; name: string; category: string }[]>`
    SELECT p.product_id::text AS product_id, p.name, c.name AS category
    FROM product p
    JOIN category c ON c.category_id = p.category_id
    WHERE p.status <> 'archived'
      AND (
        NOT EXISTS (SELECT 1 FROM collection_product cp WHERE cp.product_id = p.product_id)
        OR p.name ~ '(#[A-Z0-9-]{3,}|\\m[A-Z]{1,4}[0-9]{3,}[A-Z0-9-]*\\M)'
      )
    ORDER BY random()
    LIMIT ${sample}`;
  console.log(`Amostra: ${picked.length} produtos, ${franchises.length} franquias conhecidas.`);

  const items = picked.map((row) => ({
    id: row.product_id,
    name: row.name,
    category: row.category,
  }));
  const { suggestions, skipped } = await cleanupBatches(items, franchises, complete);

  const byId = new Map(items.map((item) => [item.id, item]));
  const rows = suggestions.map((suggestion) => ({
    product_id: suggestion.id,
    category: byId.get(suggestion.id)?.category ?? '',
    current_name: byId.get(suggestion.id)?.name ?? '',
    suggested_name: suggestion.name,
    franchise: !suggestion.franchise
      ? ''
      : suggestion.franchise.kind === 'existing'
        ? suggestion.franchise.slug
        : `NOVA: ${suggestion.franchise.name}`,
    confidence: suggestion.confidence,
  }));

  const out = resolve(values.out ?? '../../.temp');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'ia-amostra.json'), JSON.stringify(rows, null, 2));
  const header = ['Categoria', 'Nome atual', 'Nome sugerido', 'Franquia', 'Confiança']
    .map(csvCell)
    .join(';');
  const lines = rows.map((row) =>
    [row.category, row.current_name, row.suggested_name, row.franchise, row.confidence]
      .map(csvCell)
      .join(';')
  );
  writeFileSync(resolve(out, 'ia-amostra.csv'), `﻿${[header, ...lines].join('\n')}`);

  const renamed = rows.filter((row) => row.current_name !== row.suggested_name).length;
  const withFranchise = rows.filter((row) => row.franchise).length;
  console.log(
    `Sugestões: ${rows.length} (${renamed} com nome mudado, ${withFranchise} com franquia), ${skipped} pulados. Arquivos em ${out}`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
