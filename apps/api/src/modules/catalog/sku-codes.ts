import { suffixFor } from '@geekstore/db';

// Código do SKU: TIPO-NNNNN[-VARIAÇÃO], ex.: CNC-00042, CNC-00042-100ML, CAM-00187-PT-M.
// O número vem de um contador por tipo (`sku_sequence`) e nunca se repete; a franquia e o nome do
// modelo ficam no produto (coleção, nome), não no código, porque o código é imutável.
const NUMBER_DIGITS = 5;

export const formatBaseCode = (type: string, n: number): string =>
  `${type}-${String(n).padStart(NUMBER_DIGITS, '0')}`;

/** O número de um código-base ("CNC-00042" -> 42), ou `null` se o código não segue o padrão. */
export function numberOfBaseCode(type: string, code: string): number | null {
  const match = code.match(new RegExp(`^${type}-(\\d+)`));
  return match ? Number(match[1]) : null;
}

// Ordem dos sufixos: cor primeiro, depois o que mede (tamanho, numeração, peso...).
export const SUFFIX_ORDER = [
  'cor',
  'edicao',
  'tamanho',
  'tamanho_infantil',
  'numeracao',
  'sabor',
  'peso',
  'capacidade',
] as const;

const sizePart = (suffix: string): string => suffix.toUpperCase().replace(/[^A-Z0-9]+/g, '-');

/** { cor: Preto, tamanho: GG } -> "PT-GG" (sufixos do catálogo de atributos). */
export function variantSuffix(attributes: Record<string, string>): string {
  return SUFFIX_ORDER.flatMap((code) => {
    const label = attributes[code];
    return label ? [sizePart(suffixFor(code, label))] : [];
  }).join('-');
}

export const skuCodeOf = (baseCode: string, attributes: Record<string, string>): string => {
  const suffix = variantSuffix(attributes);
  return suffix ? `${baseCode}-${suffix}` : baseCode;
};

/** Junta sufixos já conhecidos (do banco) na ordem padrão; atributo fora da lista vai depois, em ordem alfabética. */
export function joinSuffixes(suffixes: Readonly<Record<string, string>>): string {
  const known = SUFFIX_ORDER.flatMap((code) => (suffixes[code] ? [sizePart(suffixes[code])] : []));
  const rest = Object.keys(suffixes)
    .filter((code) => !(SUFFIX_ORDER as readonly string[]).includes(code))
    .sort()
    .map((code) => sizePart(suffixes[code] as string));
  return [...known, ...rest].join('-');
}
