// Aplica no banco o que o ai:cleanup sugeriu (nomes, franquias, códigos de fabricante). Sem --apply só
// mostra o que mudaria e grava .temp/ia-aplicado.csv (nome antigo -> novo). SKU nunca é tocado.
//
//   pnpm --filter api ai:apply
//   pnpm --filter api ai:apply --apply --confirm localhost/geekstore
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import { applyCleanup, loadProducts, planCleanup } from '../modules/ai/apply-cleanup';
import type { CleanupSuggestion } from '../modules/ai/name-cleanup';

function databaseTarget(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  return `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
}

const csv = (value: string) => `"${value.replace(/"/g, '""')}"`;

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '../../.temp' },
      apply: { type: 'boolean', default: false },
      confirm: { type: 'string' },
    },
  });
  const dir = resolve(values.dir ?? '../../.temp');
  const suggestions = readFileSync(resolve(dir, 'ia-resultados.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CleanupSuggestion);
  const [products, franchises] = await Promise.all([
    loadProducts(),
    prisma.collection.findMany({ where: { kind: 'franchise' }, select: { slug: true } }),
  ]);
  const plan = planCleanup(suggestions, products, new Set(franchises.map((f) => f.slug)));

  mkdirSync(dir, { recursive: true });
  const lines = plan.renames.map((r) => [r.old_name, r.name].map(csv).join(';'));
  writeFileSync(
    resolve(dir, 'ia-aplicado.csv'),
    `﻿${['"Nome antigo";"Nome novo"', ...lines].join('\n')}`
  );
  console.log(
    `Sugestões: ${suggestions.length}. Renomear: ${plan.renames.length}. Ligar a franquia: ${plan.franchiseLinks.length}. ` +
      `Franquias novas: ${plan.newFranchises.size}. Códigos guardados: ${plan.codes.size}. ` +
      `Ignoradas por confiança baixa: ${plan.skipped.low_confidence}.`
  );
  if (!values.apply) {
    console.log('Nada foi gravado (use --apply --confirm <host>/<banco>).');
    return;
  }
  const target = databaseTarget();
  if (values.confirm !== target) {
    throw new Error(
      `Para gravar, confirme o banco: --confirm ${target}  (recebido: ${values.confirm ?? 'nada'})`
    );
  }
  const { runId } = await applyCleanup(plan);
  console.log(`Aplicado (execução ${runId}). Nomes antigos em ia-aplicado.csv.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
