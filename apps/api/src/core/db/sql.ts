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

/** Escapa `\`, `%` e `_` para o valor entrar literal num `ILIKE` (escape padrão: `\`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** `coluna` contém `termo`, sem diferenciar maiúsculas nem acentos ("acessorios" acha "Acessórios"). */
export function containsInsensitive(column: Prisma.Sql, term: string): Prisma.Sql {
  const pattern = `%${escapeLike(term)}%`;
  return Prisma.sql`unaccent(${column}) ILIKE unaccent(${pattern})`;
}
