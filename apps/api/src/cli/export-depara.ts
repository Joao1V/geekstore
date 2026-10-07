// Gera a planilha "de-para" para conferir a base antiga contra a nova: um item do ERP por linha, com o
// SKU novo, o nome novo, o estoque e o preço de agora.
//   pnpm --filter api export:depara --out ../../.temp
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

type Row = {
  erp_code: string;
  erp_name: string | null;
  sku: string;
  product: string;
  category: string;
  price_cents: number | null;
  available: number;
};

const csv = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string', default: '../../.temp' } } });
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT s.legacy_code AS erp_code, s.legacy_data->>'erp_name' AS erp_name, s.code AS sku,
           p.name AS product, c.name AS category,
           (SELECT pr.price_cents FROM price pr JOIN channel ch ON ch.channel_id = pr.channel_id
             WHERE pr.sku_id = s.sku_id AND ch.code = 'site' ORDER BY pr.starts_at DESC LIMIT 1) AS price_cents,
           COALESCE((SELECT SUM(l.on_hand - l.reserved) FROM stock_level l WHERE l.sku_id = s.sku_id), 0)::int AS available
    FROM sku s JOIN product p ON p.product_id = s.product_id JOIN category c ON c.category_id = p.category_id
    WHERE s.legacy_code IS NOT NULL
    ORDER BY s.legacy_code::bigint NULLS LAST`;
  const header = [
    'Código ERP',
    'Nome no ERP',
    'SKU novo',
    'Produto novo',
    'Categoria',
    'Preço (R$)',
    'Disponível',
  ];
  const lines = rows.map((row) =>
    [
      row.erp_code,
      row.erp_name,
      row.sku,
      row.product,
      row.category,
      row.price_cents === null ? '' : (row.price_cents / 100).toFixed(2).replace('.', ','),
      row.available,
    ]
      .map(csv)
      .join(';')
  );
  const dir = resolve(values.out ?? '../../.temp');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'de-para.csv'), `﻿${[header.map(csv).join(';'), ...lines].join('\n')}`);
  console.log(`de-para.csv: ${rows.length} itens em ${dir}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
