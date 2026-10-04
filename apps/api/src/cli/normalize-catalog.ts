// Gera o catálogo normalizado a partir do export do ERP. Não toca o banco.
//
//   pnpm --filter api normalize:catalog --file ../../.temp/geek_store_produtos.json
//   pnpm --filter api normalize:catalog --file <json> --scope canecas,funko,camisetas   (piloto)
//
// Saídas (em --out, padrão ../../.temp): catalogo-normalizado.json (o que a loja importa),
// mapa-legado.json (SKU <-> código do ERP, só para consulta) e revisao.csv (o que merece olho humano).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { readErpSource } from '../modules/migration/erp/erp-source';
import { buildPlan } from '../modules/migration/erp/plan';
import { normalizePlan } from '../modules/migration/normalize/normalize';

const DEFAULT_OUT = '../../.temp';

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      scope: { type: 'string' },
      out: { type: 'string', default: DEFAULT_OUT },
    },
  });
  if (!values.file) throw new Error('Informe o arquivo do ERP com --file <caminho do json>.');

  const now = new Date();
  const source = readErpSource(resolve(values.file));
  const plan = buildPlan(source.rows, { now });
  const scope = values.scope ? values.scope.split(',').map((slug) => slug.trim()) : null;
  const result = normalizePlan(plan, { now, sourceSha256: source.sha256, scope });

  const out = resolve(values.out ?? DEFAULT_OUT);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'catalogo-normalizado.json'), JSON.stringify(result.catalog, null, 2));
  writeFileSync(resolve(out, 'mapa-legado.json'), JSON.stringify(result.legacyMap, null, 2));
  const header = ['SKU', 'Produto', 'Motivo'].map(csvCell).join(';');
  const lines = result.review.map((row) =>
    [row.sku_code, row.name, row.reasons.join(', ')].map(csvCell).join(';')
  );
  writeFileSync(resolve(out, 'revisao.csv'), `﻿${[header, ...lines].join('\n')}`);

  const skus = result.catalog.products.reduce((sum, product) => sum + product.skus.length, 0);
  console.log(
    `Catálogo normalizado: ${result.catalog.products.length} produtos, ${skus} SKUs, ${result.review.length} para revisar. Arquivos em ${out}`
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
