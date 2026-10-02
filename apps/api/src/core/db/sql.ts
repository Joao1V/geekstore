import { Prisma } from '@geekstore/db';

/**
 * Peças de SQL cru para PostgreSQL. Os parâmetros do `$queryRaw`/`$executeRaw` chegam como texto,
 * e o PostgreSQL não compara `uuid = text`: todo id vai com `::uuid` (use `asUuid`), e todo
 * inteiro que entra em aritmética ou comparação vai com `::int` (use `asInt`).
 */

export const asUuid = (value: string): Prisma.Sql => Prisma.sql`${value}::uuid`;
export const asInt = (value: number): Prisma.Sql => Prisma.sql`${value}::int`;

/**
 * Agora em UTC como `timestamp` sem fuso, que é como o Prisma grava `DateTime`. Independe do fuso
 * da sessão: `now()` sozinho é `timestamptz` e seria convertido pelo fuso da conexão.
 */
export const utcNow: Prisma.Sql = Prisma.sql`(now() AT TIME ZONE 'UTC')`;

/** Texto sem acento, em minúsculas e só com letras e números: "R.P.G" -> "rpg". */
export function compactText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** O mesmo `compactText`, mas para a coluna, dentro do SQL (precisa da extensão `unaccent`). */
const compactColumn = (column: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`regexp_replace(lower(unaccent(${column})), '[^a-z0-9]', '', 'g')`;

/**
 * Busca de texto tolerante: cada palavra do termo precisa aparecer em alguma das colunas, ignorando
 * maiúsculas, acentos e pontuação ("rpg" acha "R.P.G", "pokemon" acha "Pokémon", "spy family" acha
 * "Spy x Family"). Termo sem letra nem número (só pontuação) não filtra nada.
 */
export function matchesSearch(columns: Prisma.Sql[], term: string): Prisma.Sql {
  const tokens = term.split(/\s+/).map(compactText).filter(Boolean);
  if (tokens.length === 0) return Prisma.sql`TRUE`;
  const perToken = tokens.map((token) => {
    const pattern = `%${token}%`; // o token só tem [a-z0-9]: nada a escapar
    return Prisma.sql`(${Prisma.join(
      columns.map((column) => Prisma.sql`${compactColumn(column)} LIKE ${pattern}`),
      ' OR '
    )})`;
  });
  return Prisma.sql`(${Prisma.join(perToken, ' AND ')})`;
}
