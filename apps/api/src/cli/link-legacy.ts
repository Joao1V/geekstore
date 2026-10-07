// Liga cada SKU ao código do item na base antiga (ERP), pelo mapa legado gerado no normalize:catalog.
//   pnpm --filter api link:legacy --file ../../.temp/mapa-legado.json --apply --confirm localhost/geekstore
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { prisma } from '@geekstore/db';

import { linkLegacy, readLegacyMap } from '../modules/migration/normalize/link-legacy';

function databaseTarget(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  return `${url.hostname}/${url.pathname.replace(/^\//, '')}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', default: '../../.temp/mapa-legado.json' },
      apply: { type: 'boolean', default: false },
      confirm: { type: 'string' },
    },
  });
  const links = readLegacyMap(resolve(values.file ?? ''));
  if (!values.apply) {
    console.log(`Mapa válido: ${links.length} ligações. Nada foi gravado.`);
    return;
  }
  const target = databaseTarget();
  if (values.confirm !== target) {
    throw new Error(
      `Para gravar, confirme o banco: --confirm ${target}  (recebido: ${values.confirm ?? 'nada'})`
    );
  }
  const result = await linkLegacy(links);
  console.log(
    `Ligados: ${result.linked}. SKUs do mapa que não existem no banco: ${result.missing}.`
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
