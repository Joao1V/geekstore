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

const MIN_FUZZY_LENGTH = 3;
const SHORT_WORD = 4;
const LENGTH_SLACK = 2;
const SHORT_DISTANCE = 1;
const LONG_DISTANCE = 2;

/** As palavras de uma coluna, sem acento e em minúsculas: "Pelúcia Stitch 25cm" -> {pelucia, stitch, 25cm}. */
const wordsOf = (column: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`unnest(string_to_array(regexp_replace(lower(unaccent(${column})), '[^a-z0-9]+', ' ', 'g'), ' ')) AS w(word)`;

/**
 * A palavra (já normalizada por `compactText`) casa com a coluna: como pedaço do texto, ou, se tiver 3+
 * letras, como palavra parecida (prefixo, ou 1 letra de diferença até 4 letras, 2 acima disso).
 */
export function matchesWord(column: Prisma.Sql, token: string): Prisma.Sql {
  const exact = Prisma.sql`${compactColumn(column)} LIKE ${`%${token}%`}`;
  if (token.length < MIN_FUZZY_LENGTH) return exact;
  const distance = token.length <= SHORT_WORD ? SHORT_DISTANCE : LONG_DISTANCE;
  return Prisma.sql`(${exact} OR EXISTS (
    SELECT 1 FROM ${wordsOf(column)}
    WHERE w.word <> '' AND (
      w.word LIKE ${`${token}%`}
      OR (abs(length(w.word) - ${asInt(token.length)}) <= ${asInt(LENGTH_SLACK)}
          AND levenshtein(w.word, ${token}) <= ${asInt(distance)})
    )
  ))`;
}

/**
 * Busca tolerante a erro de digitação, para quando a busca exata não acha nada: cada palavra do termo
 * precisa casar (ver `matchesWord`) com alguma das colunas. "stich peluzia" acha "Pelúcia Disney Stitch".
 * Palavras com menos de 3 letras ficam exatas (distância 1 em 2 letras casaria com qualquer coisa).
 * Precisa de `fuzzystrmatch`.
 */
export function matchesSearchFuzzy(columns: Prisma.Sql[], term: string): Prisma.Sql {
  const tokens = term.split(/\s+/).map(compactText).filter(Boolean);
  if (tokens.length === 0) return Prisma.sql`TRUE`;
  const perToken = tokens.map(
    (token) =>
      Prisma.sql`(${Prisma.join(
        columns.map((column) => matchesWord(column, token)),
        ' OR '
      )})`
  );
  return Prisma.sql`(${Prisma.join(perToken, ' AND ')})`;
}
