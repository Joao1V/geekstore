// Normaliza o catálogo gravado em famílias: um produto com suas variações (cor, tamanho, modelo),
// em vez de um produto por cor. Sem --apply só mostra o plano e grava os relatórios em .temp/.
//
//   pnpm --filter api normalize:families
//   pnpm --filter api normalize:families --apply --confirm localhost/geekstore
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';
import { planFamilies } from '../modules/catalog/families';
import {
  applyFamilyPlan,
  loadFamilyProducts,
  recodeSkus,
} from '../modules/catalog/families.service';

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
  mkdirSync(dir, { recursive: true });

  const products = await loadFamilyProducts();
  const plan = planFamilies(products);
  const byId = new Map(products.map((product) => [product.product_id, product]));
  const merged = plan.changes.filter((change) => change.donorIds.length > 0);
  const solo = plan.changes.filter((change) => change.donorIds.length === 0);
  const absorbed = merged.reduce((sum, change) => sum + change.donorIds.length, 0);

  const lines = plan.changes.map((change) => {
    const survivor = byId.get(change.survivorId);
    const from = [change.survivorId, ...change.donorIds].map((id) => byId.get(id)?.name ?? '');
    const sample = change.skus
      .slice(0, 3)
      .map((sku) =>
        Object.entries(sku.attrs)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
      )
      .join(' | ');
    return [
      change.donorIds.length > 0 ? 'família' : 'cor no nome',
      survivor?.code ?? '',
      change.name,
      String(change.skus.length),
      from.join(' // '),
      sample,
    ]
      .map(csv)
      .join(';');
  });
  writeFileSync(
    resolve(dir, 'familias-plano.csv'),
    `﻿"Tipo";"Código";"Novo nome";"SKUs";"Nomes de hoje";"Variações (amostra)"\n${lines.join('\n')}`
  );
  writeFileSync(
    resolve(dir, 'familias-conflitos.csv'),
    `﻿"Motivo";"Nomes"\n${plan.conflicts.map((c) => `${csv(c.reason)};${csv(c.names.join(' // '))}`).join('\n')}`
  );
  console.log(
    `Famílias a juntar: ${merged.length} (${absorbed + merged.length} produtos viram ${merged.length}). ` +
      `Cor tirada do nome: ${solo.length}. Conflitos (não mexe): ${plan.conflicts.length}.`
  );

  if (!values.apply) {
    console.log(
      'Nada foi gravado (use --apply --confirm <host>/<banco>). Relatórios em .temp/familias-*.csv'
    );
    return;
  }
  const target = databaseTarget();
  if (values.confirm !== target) {
    throw new Error(
      `Para gravar, confirme o banco: --confirm ${target}  (recebido: ${values.confirm ?? 'nada'})`
    );
  }
  const categoryOf = new Map(products.map((product) => [product.product_id, product.category_id]));
  await applyFamilyPlan(plan, categoryOf, (done, total) => {
    if (done % 200 === 0 || done === total) console.log(`  ${done}/${total}`);
  });
  const touched = new Set(plan.changes.map((change) => change.survivorId));
  const recode = await recodeSkus(touched);
  console.log(`SKUs com código refeito: ${recode.renamed}. Sem refazer: ${recode.skipped.length}.`);
  for (const item of recode.skipped.slice(0, 10)) console.log(`  ${item.product}: ${item.reason}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
