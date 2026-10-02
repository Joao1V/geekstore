// Lógica pura da "grade" de um produto: do que o lojista escolhe (cor: Preto e Branco; tamanho: P, M, G)
// saem as combinações, e de cada combinação um código de SKU sugerido (código do produto + sufixos).
// Fica aqui, sem React nem HTTP, para ser testada e reaproveitada pelo front e pela API.

export type GridAxis = { attribute: string; values: string[] };
export type GridCombination = Record<string, string>;

/** Atributo cadastrado, no formato que a grade precisa (código do valor -> sufixo de SKU). */
export type GridAttributeDefinition = {
  code: string;
  values: { code: string; sku_suffix: string }[];
};

/**
 * Produto cartesiano dos eixos, na ordem em que foram escolhidos. Eixo sem valor é ignorado
 * (não zera a grade). Sem nenhum eixo com valor, não há combinação.
 */
export function combinations(axes: readonly GridAxis[]): GridCombination[] {
  const active = axes.filter((axis) => axis.attribute && axis.values.length > 0);
  if (active.length === 0) return [];
  return active.reduce<GridCombination[]>(
    (acc, axis) =>
      acc.flatMap((combo) => axis.values.map((value) => ({ ...combo, [axis.attribute]: value }))),
    [{}]
  );
}

/** Chave estável de uma combinação, independente da ordem dos atributos: `cor=preto|tamanho=m`. */
export function combinationKey(attributes: GridCombination): string {
  return Object.entries(attributes)
    .filter(([, value]) => value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([attribute, value]) => `${attribute}=${value}`)
    .join('|');
}

const toCodePart = (suffix: string): string =>
  suffix
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Código sugerido: `CAM-NARUTO` + `{cor: preto, tamanho: m}` -> `CAM-NARUTO-PT-M`. Segue a ordem dos
 * eixos escolhidos. Valor sem sufixo cadastrado cai no próprio código do valor.
 */
export function suggestSkuCode(
  productCode: string,
  attributes: GridCombination,
  axisOrder: readonly string[],
  definitions: readonly GridAttributeDefinition[]
): string {
  const parts = axisOrder.flatMap((attribute) => {
    const value = attributes[attribute];
    if (!value) return [];
    const suffix = definitions
      .find((definition) => definition.code === attribute)
      ?.values.find((candidate) => candidate.code === value)?.sku_suffix;
    return [toCodePart(suffix ?? value)];
  });
  return [productCode.trim().toUpperCase(), ...parts].filter(Boolean).join('-');
}

export type GridRow = { sku_id: string | null; attributes: GridCombination };

/**
 * Atualiza as linhas da grade depois de o lojista mudar os eixos:
 *  - SKU que já existe no banco nunca some (não se apaga SKU por aqui);
 *  - linha nova cuja combinação continua valendo é mantida como está (preserva o que foi digitado);
 *  - linha nova de combinação que saiu da grade é descartada;
 *  - combinação sem linha ganha uma linha nova (`create` monta os campos padrão).
 */
export function mergeGrid<Row extends GridRow>(
  current: readonly Row[],
  wanted: readonly GridCombination[],
  create: (attributes: GridCombination) => Row
): Row[] {
  const byKey = new Map(current.map((row) => [combinationKey(row.attributes), row]));

  const kept = wanted.map((combo) => byKey.get(combinationKey(combo)) ?? create(combo));
  const keptKeys = new Set(kept.map((row) => combinationKey(row.attributes)));
  const leftoverExisting = current.filter(
    (row) => row.sku_id !== null && !keptKeys.has(combinationKey(row.attributes))
  );
  // Linhas novas fora da grade saem; as já gravadas ficam depois das combinações.
  return [...kept, ...leftoverExisting];
}

/** Eixos iniciais de um produto que já tem SKUs: atributos usados e os valores de cada um. */
export function axesFromSkus(skus: readonly { attributes: GridCombination }[]): GridAxis[] {
  const axes = new Map<string, string[]>();
  for (const sku of skus) {
    for (const [attribute, value] of Object.entries(sku.attributes)) {
      const values = axes.get(attribute) ?? [];
      if (!values.includes(value)) values.push(value);
      axes.set(attribute, values);
    }
  }
  return [...axes].map(([attribute, values]) => ({ attribute, values }));
}

const CODE_STOP_WORDS = new Set([
  'A',
  'O',
  'AS',
  'OS',
  'E',
  'DE',
  'DA',
  'DO',
  'DAS',
  'DOS',
  'COM',
  'PARA',
  'EM',
]);
const CODE_WORDS = 2;
const CODE_LETTERS = 3;

/** "Camiseta Naruto Kunai" -> "CAM-NAR": 3 letras das duas primeiras palavras. Só uma sugestão. */
export function suggestProductCode(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ''))
    .filter((word) => word && !CODE_STOP_WORDS.has(word))
    .slice(0, CODE_WORDS)
    .map((word) => word.slice(0, CODE_LETTERS))
    .join('-');
}
