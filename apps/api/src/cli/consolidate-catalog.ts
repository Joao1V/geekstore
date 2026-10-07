// Junta produtos repetidos e vira variação o que é a mesma peça com tamanho/cor/lote diferente.
// Sem --apply só mostra o que faria.
//   pnpm --filter api consolidate:catalog
//   pnpm --filter api consolidate:catalog --apply --confirm localhost/geekstore
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import {
  loadRows,
  mergeAsVariants,
  mergeSameEan,
  planConsolidation,
} from '../modules/catalog/consolidate';

function databaseTarget(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  return `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
}

async function main() {
  const { values } = parseArgs({
    options: { apply: { type: 'boolean', default: false }, confirm: { type: 'string' } },
  });
  const rows = await loadRows();
  const plan = planConsolidation(rows);
  const duplicatesRemoved = plan.sameEan.reduce((sum, group) => sum + group.length - 1, 0);
  const productsAbsorbed = plan.variants.reduce((sum, group) => sum + group.length - 1, 0);
  const byCategory = new Map<string, number>();
  for (const group of plan.variants) {
    const category = group[0]?.[0]?.category ?? '?';
    byCategory.set(category, (byCategory.get(category) ?? 0) + group.length - 1);
  }
  console.log(
    `Mesmo EAN: ${plan.sameEan.length} grupos, ${duplicatesRemoved} SKUs repetidos saem.\n` +
      `Mesmo nome, itens diferentes: ${plan.variants.length} grupos, ${productsAbsorbed} produtos viram variações.`
  );
  console.log(
    'Por categoria (variações):',
    [...byCategory]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([c, n]) => `${c} ${n}`)
      .join(', ')
  );
  if (plan.review.length > 0) {
    const lines = plan.review.flatMap((group) =>
      group
        .flat()
        .map((row) =>
          [
            group[0]?.[0]?.name ?? '',
            row.sku_code,
            JSON.stringify(row.attrs),
            row.legacy_code ?? '',
          ]
            .map((cell) => `"${cell.replace(/"/g, '""')}"`)
            .join(';')
        )
    );
    mkdirSync(resolve('../../.temp'), { recursive: true });
    writeFileSync(
      resolve('../../.temp/consolidacao-revisao.csv'),
      `\uFEFF${['"Produto";"SKU";"Atributos";"Código ERP"', ...lines].join('\n')}`
    );
    console.log(
      `Para revisar (família + item sem tamanho): ${plan.review.length} grupos em .temp/consolidacao-revisao.csv`
    );
  }
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
  const owner = await prisma.user.findFirstOrThrow({
    where: { email: 'admin@geekstore.local' },
    select: { user_id: true },
  });
  let done = 0;
  for (const group of plan.sameEan) {
    await mergeSameEan(owner.user_id, group);
    done += 1;
    if (done % 100 === 0) console.log(`  EAN: ${done}/${plan.sameEan.length}`);
  }
  // O que a primeira fase mudou altera os grupos da segunda: recalcula antes.
  const second = planConsolidation(await loadRows());
  let variantsDone = 0;
  for (const group of second.variants) {
    await mergeAsVariants(group);
    variantsDone += 1;
    if (variantsDone % 100 === 0)
      console.log(`  variações: ${variantsDone}/${second.variants.length}`);
  }
  console.log(`Feito: ${done} grupos por EAN, ${variantsDone} grupos viraram variações.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
