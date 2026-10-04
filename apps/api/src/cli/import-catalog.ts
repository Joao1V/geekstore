// Importa o catálogo normalizado para o banco. Sem --apply só valida o arquivo.
//
//   pnpm --filter api import:catalog --file ../../.temp/catalogo-normalizado.json
//   pnpm --filter api import:catalog --file <json> --apply --confirm <host>/<banco>
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import { importCatalog, readCatalogFile } from '../modules/migration/normalize/load-catalog';

function databaseTarget(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  return `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      apply: { type: 'boolean', default: false },
      confirm: { type: 'string' },
    },
  });
  if (!values.file) throw new Error('Informe o arquivo com --file <caminho do json>.');
  const catalog = readCatalogFile(resolve(values.file));
  const skus = catalog.products.reduce((sum, product) => sum + product.skus.length, 0);

  if (!values.apply) {
    console.log(
      `Arquivo válido: ${catalog.products.length} produtos, ${skus} SKUs. Nada foi gravado.`
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
  const result = await importCatalog(catalog, new Date());
  console.log(
    'Concluído:',
    JSON.stringify({ ...result.inserted, ja_importados: result.alreadyImported })
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
