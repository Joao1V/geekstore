// Grava o estado ATUAL do banco no formato do catálogo normalizado (o mesmo que o import:catalog lê).
// É assim que a limpeza feita no banco (nomes, franquias, consolidação) deixa de depender só dele.
// O arquivo anterior é guardado ao lado, com sufixo .antes.json.
//
//   pnpm --filter api export:catalog --out ../../.temp/catalogo-normalizado.json
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import { exportCatalog } from '../modules/migration/normalize/export-catalog';

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  if (!values.out) throw new Error('Informe o arquivo de saída com --out <caminho do json>.');
  const out = resolve(values.out);

  const catalog = await exportCatalog(new Date());
  const skus = catalog.products.reduce((sum, product) => sum + product.skus.length, 0);

  if (existsSync(out)) copyFileSync(out, out.replace(/\.json$/, '.antes.json'));
  writeFileSync(out, JSON.stringify(catalog));
  console.log(
    `Gravado em ${out}: ${catalog.products.length} produtos, ${skus} SKUs, ${catalog.collections?.length ?? 0} franquias.`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
