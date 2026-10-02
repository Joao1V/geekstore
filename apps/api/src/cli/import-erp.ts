// Importador do catálogo do ERP. Por padrão SÓ SIMULA: lê o arquivo, monta o plano e grava os
// relatórios para o cliente aprovar. Nenhum banco é tocado sem `--apply`.
//
//   pnpm --filter api import:erp --file ../../.temp/geek_store_produtos.json
//   pnpm --filter api import:erp --file <json> --apply --confirm <host>/<banco>
//
// `--confirm` precisa ser igual ao banco do DATABASE_URL (ex.: localhost/geekstore): evita gravar
// no banco errado por engano de ambiente.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { readErpSource } from '../modules/migration/erp/erp-source';
import { runImport } from '../modules/migration/erp/load';
import { buildPlan } from '../modules/migration/erp/plan';
import { buildReport } from '../modules/migration/erp/report';

const DEFAULT_REPORT_DIR = '../../.temp/import-report';

function databaseTarget(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  return `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
}

function writeReports(dir: string, files: ReturnType<typeof buildReport>) {
  mkdirSync(dir, { recursive: true });
  for (const file of files) writeFileSync(resolve(dir, file.name), file.content);
  console.log(`Relatórios em ${dir}`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'report-dir': { type: 'string', default: DEFAULT_REPORT_DIR },
      apply: { type: 'boolean', default: false },
      confirm: { type: 'string' },
    },
  });
  if (!values.file) throw new Error('Informe o arquivo com --file <caminho do json>.');

  const now = new Date();
  const source = readErpSource(resolve(values.file));
  const dir = resolve(values['report-dir'] ?? DEFAULT_REPORT_DIR);

  if (!values.apply) {
    const plan = buildPlan(source.rows, { now });
    writeReports(dir, buildReport(plan, source, now));
    console.log(
      `Simulação: ${plan.items.length} itens a importar, ${plan.skipped.length} pulados, ${source.invalid.length} inválidos.`
    );
    return;
  }

  const target = databaseTarget();
  if (values.confirm !== target) {
    throw new Error(
      `Para gravar, confirme o banco: --confirm ${target}  (recebido: ${values.confirm ?? 'nada'})`
    );
  }
  console.log(`Gravando em ${target}...`);
  const result = await runImport(source, now);
  // Subpasta própria: a carga nunca sobrescreve o relatório de simulação que o cliente aprova.
  const loadDir = resolve(dir, `carga-${now.toISOString().replace(/[:.]/g, '-')}`);
  writeReports(loadDir, buildReport(result.plan, source, now));
  console.log(
    'Concluído:',
    JSON.stringify({
      ...result.inserted,
      categorias: result.categories,
      ja_importados: result.alreadyImported,
    })
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => import('@geekstore/db').then(({ prisma }) => prisma.$disconnect()));
