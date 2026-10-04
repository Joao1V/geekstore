// Relatório do catálogo do ERP: lê o arquivo, monta o plano e grava os relatórios (inconsistências,
// categorização, SKUs). Não toca o banco. Para carregar o catálogo, use `normalize:catalog` (gera o
// arquivo limpo) e `import:catalog` (grava).
//
//   pnpm --filter api import:erp --file ../../.temp/geek_store_produtos.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { readErpSource } from '../modules/migration/erp/erp-source';
import { buildPlan } from '../modules/migration/erp/plan';
import { buildReport } from '../modules/migration/erp/report';

const DEFAULT_REPORT_DIR = '../../.temp/import-report';

function writeReports(dir: string, files: ReturnType<typeof buildReport>) {
  mkdirSync(dir, { recursive: true });
  for (const file of files) writeFileSync(resolve(dir, file.name), file.content);
  console.log(`Relatórios em ${dir}`);
}

function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'report-dir': { type: 'string', default: DEFAULT_REPORT_DIR },
    },
  });
  if (!values.file) throw new Error('Informe o arquivo com --file <caminho do json>.');

  const now = new Date();
  const source = readErpSource(resolve(values.file));
  const dir = resolve(values['report-dir'] ?? DEFAULT_REPORT_DIR);

  const plan = buildPlan(source.rows, { now });
  writeReports(dir, buildReport(plan, source, now));
  console.log(
    `Simulação: ${plan.items.length} itens, ${plan.skipped.length} pulados, ${source.invalid.length} inválidos.`
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
