import {
  BABY_LOOK,
  COLORS,
  canonicalColor,
  isSize,
  MODEL_CODE,
  SIZE_LABELS,
  TRAILING_KIDS_SIZE,
  VOLUME,
  WEIGHT,
} from '../migration/erp/plan-variants';

// Normalização por famílias: um produto ("Camiseta Batman Shadows") com suas variações (cor, tamanho,
// modelo...), em vez de um produto por cor ou por tamanho. Roda sobre o catálogo já gravado, nas
// categorias onde cor e tamanho são variação de verdade (moda, bolsas, casa, papelaria, acessórios).
// Em mangá, Funko, LEGO ou miniatura dois itens parecidos são itens diferentes: ficam de fora.

export const FAMILY_CATEGORIES: ReadonlySet<string> = new Set([
  'camisetas',
  'pijamas',
  'moda-pet',
  'agasalhos',
  'fantasias',
  'calcados-e-pantufas',
  'meias',
  'acessorios-de-moda',
  'mochilas',
  'bolsas',
  'carteiras-e-necessaires',
  'malas',
  'copos-e-garrafas',
  'canecas',
  'cozinha-e-lancheiras',
  'almofadas',
  'papelaria-e-escritorio',
  'acessorios-de-jogo',
]);

const CLOTHING_ROOT = 'moda-geek';
// Cor que faz parte do nome da personagem ("Lanterna Verde"): não é variação.
const NOT_A_COLOR_AFTER = new Set(['LANTERNA', 'ARQUEIRO', 'DUENDE', 'GOBLIN']);
// Cor depois de um conector é parte de uma expressão ("Pomo de Ouro", "Preto e Cinza"), não variação.
const CONNECTORS = new Set(['E', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'A', 'O', 'COM', 'EM', 'PARA']);
const STYLES: readonly string[][] = [
  ['BABY', 'LOOK'],
  ['MANGA', 'LONGA'],
  ['REGATA'],
  ['POLO'],
  ['OVERSIZED'],
  ['CROPPED'],
  ['RAGLAN'],
];

const strip = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
const titleCase = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

// A lista de cores do ERP é sem acento; o valor guardado leva o acento certo.
const ACCENTED: Record<string, string> = {
  Lilas: 'Lilás',
  Salmao: 'Salmão',
  Petroleo: 'Petróleo',
  Fucsia: 'Fúcsia',
  Translucido: 'Translúcido',
  Fume: 'Fumê',
};
const accentedColor = (color: string): string =>
  color
    .split(' ')
    .map((word) => ACCENTED[word] ?? word)
    .join(' ');

/** `code`: código de fabricante que estava no fim do nome (ex.: MJ47013AG). */
export type Parsed = { base: string; attrs: Record<string, string>; code?: string };

/** "350 Ml" vira um token só ("350Ml"), para a medida ser reconhecida. */
function joinMeasures(tokens: string[]): string[] {
  return tokens.reduce<string[]>((out, token) => {
    const previous = out.at(-1);
    if (previous && /^\d+(?:[.,]\d+)?$/.test(previous) && /^(ML|L|G|KG)$/i.test(token)) {
      return [...out.slice(0, -1), `${previous}${token}`];
    }
    return [...out, token];
  }, []);
}

/**
 * Lê o nome de trás para a frente: tira código de fabricante, tamanho e cor do FIM do nome (é onde o
 * ERP os coloca), e, com `scope: 'all'`, medidas (350ML, 80g) de qualquer posição. `scope: 'color'`
 * só tira a cor. "Camiseta Naruto Kunai Preto GG" -> base "Camiseta Naruto Kunai", cor Preto, tamanho GG.
 */
export function parseName(name: string, root: string, scope: 'color' | 'all'): Parsed {
  const all = scope === 'all';
  const clothing = root === CLOTHING_ROOT;
  const split = name.trim().split(/\s+/).filter(Boolean);
  const tokens = all ? joinMeasures(split) : split;
  const norm = tokens.map(strip);
  const isKids = norm.some(
    (token) => token === 'INF' || token === 'INFANTIL' || token === 'JUVENIL'
  );
  const attrs: Record<string, string> = {};
  let code: string | undefined;
  let end = tokens.length;

  while (end > 1) {
    const token = tokens[end - 1] as string;
    const upper = norm[end - 1] as string;
    if (MODEL_CODE.test(token) && !VOLUME.test(token) && !WEIGHT.test(token)) {
      code ??= token;
      end -= 1;
      continue;
    }
    if (all && clothing) {
      const afterLabel = end > 1 && SIZE_LABELS.has(norm[end - 2] ?? '') && /^\d{1,2}$/.test(upper);
      if (
        isSize(upper, isKids) ||
        (end === tokens.length && TRAILING_KIDS_SIZE.test(upper)) ||
        afterLabel
      ) {
        if (!attrs.tamanho && !attrs.tamanho_infantil && !attrs.numeracao) {
          if (/^\d{2}[/-]\d{2}$/.test(upper)) attrs.numeracao = upper.replace('-', '/');
          else if (/^\d{1,2}$/.test(upper)) attrs.tamanho_infantil = String(Number(upper));
          else attrs.tamanho = BABY_LOOK[upper] ?? upper;
        }
        end -= afterLabel ? 2 : 1;
        continue;
      }
      if (SIZE_LABELS.has(upper)) {
        end -= 1;
        continue;
      }
    }
    if (!attrs.cor) {
      const color = COLORS.find((candidate) => {
        const words = candidate.split(' ');
        if (end - words.length < 1) return false;
        const tail = norm.slice(end - words.length, end);
        const before = norm[end - words.length - 1] ?? '';
        // "Preto e Cinza" são duas cores no mesmo item: não é variação, fica como está.
        return (
          words.every((word, i) => tail[i] === word) &&
          !NOT_A_COLOR_AFTER.has(before) &&
          !CONNECTORS.has(before)
        );
      });
      if (color) {
        attrs.cor = accentedColor(canonicalColor(color));
        end -= color.split(' ').length;
        continue;
      }
    }
    break;
  }

  let rest = tokens.slice(0, end);
  if (all) {
    const volume = rest.find((token) => VOLUME.test(token));
    if (volume) {
      attrs.capacidade = volume.toLowerCase().replace(/lts?$/, 'l');
      rest = rest.filter((token) => token !== volume);
    }
    const weight = rest.find((token) => WEIGHT.test(token));
    if (weight) {
      attrs.peso = weight.toLowerCase();
      rest = rest.filter((token) => token !== weight);
    }
  }
  return { base: rest.join(' ').trim(), attrs, ...(code ? { code } : {}) };
}

/** Tira "Regata", "Polo", "Baby Look"... do nome; vira o atributo Modelo (só em roupa, só em família). */
export function takeStyle(base: string): { base: string; modelo?: string } {
  const tokens = base.split(/\s+/);
  const norm = tokens.map(strip);
  for (const style of STYLES) {
    const at = norm.findIndex((_, i) => style.every((word, k) => norm[i + k] === word));
    if (at >= 0) {
      const rest = [...tokens.slice(0, at), ...tokens.slice(at + style.length)];
      return { base: rest.join(' '), modelo: style.map(titleCase).join(' ') };
    }
  }
  return { base };
}

export const familyKey = (categoryId: string, base: string): string =>
  `${categoryId}|${strip(base)
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()}`;

export type PlanSku = { sku_id: string; code: string; attrs: Record<string, string> };
export type PlanProduct = {
  product_id: string;
  code: string;
  name: string;
  category_id: string;
  category_slug: string;
  root_slug: string;
  skus: PlanSku[];
};

export type FamilyChange = {
  survivorId: string;
  donorIds: string[];
  /** Novo nome do produto que fica. */
  name: string;
  /** Atributos finais (código do atributo -> rótulo) de TODOS os SKUs da família. */
  skus: {
    sku_id: string;
    product_id: string;
    attrs: Record<string, string>;
    /** Código de fabricante que o nome tinha: grava no SKU se ele ainda não tiver um. */
    nameCode?: string;
  }[];
};

export type FamilyConflict = { key: string; reason: string; names: string[] };

export type FamilyPlan = { changes: FamilyChange[]; conflicts: FamilyConflict[] };

const tupleKey = (attrs: Record<string, string>): string =>
  JSON.stringify(Object.entries(attrs).sort());
const kindsKey = (attrs: Record<string, string>): string => Object.keys(attrs).sort().join(',');

type Entry = { product: PlanProduct; all: Parsed; style: { base: string; modelo?: string } };

/** A cor tirada do nome só entra se o SKU ainda não tem cor (o que já está gravado manda). */
const withNameAttrs = (sku: PlanSku, fromName: Record<string, string>): Record<string, string> => ({
  ...fromName,
  ...sku.attrs,
});

function soloChange(product: PlanProduct, color: Parsed): FamilyChange | null {
  if (!color.attrs.cor || color.base === product.name) return null;
  return {
    survivorId: product.product_id,
    donorIds: [],
    name: color.base,
    skus: product.skus.map((sku) => ({
      sku_id: sku.sku_id,
      product_id: product.product_id,
      attrs: withNameAttrs(sku, { cor: color.attrs.cor as string }),
      ...(color.code ? { nameCode: color.code } : {}),
    })),
  };
}

export function planFamilies(products: readonly PlanProduct[]): FamilyPlan {
  const entries: Entry[] = products
    .filter((product) => FAMILY_CATEGORIES.has(product.category_slug) && product.skus.length > 0)
    .map((product) => {
      const all = parseName(product.name, product.root_slug, 'all');
      const style = product.root_slug === CLOTHING_ROOT ? takeStyle(all.base) : { base: all.base };
      return { product, all, style };
    });

  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = familyKey(entry.product.category_id, entry.style.base);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const changes: FamilyChange[] = [];
  const conflicts: FamilyConflict[] = [];
  const solo = (entry: Entry) => {
    const change = soloChange(
      entry.product,
      parseName(entry.product.name, entry.product.root_slug, 'color')
    );
    if (change) changes.push(change);
  };

  for (const [key, group] of groups) {
    if (group.length === 1) {
      solo(group[0] as Entry);
      continue;
    }
    const sorted = [...group].sort((a, b) => a.product.code.localeCompare(b.product.code));
    // Numa família com "Regata" ou "Polo", a versão sem estilo é a "Básica".
    const hasStyle = sorted.some((entry) => entry.style.modelo);
    const skus = sorted.flatMap((entry) =>
      entry.product.skus.map((sku) => ({
        sku_id: sku.sku_id,
        product_id: entry.product.product_id,
        ...(entry.all.code ? { nameCode: entry.all.code } : {}),
        attrs: withNameAttrs(sku, {
          ...entry.all.attrs,
          ...(entry.style.modelo || hasStyle ? { modelo: entry.style.modelo ?? 'Básica' } : {}),
        }),
      }))
    );
    const names = sorted.map((entry) => entry.product.name);
    if (new Set(skus.map((sku) => kindsKey(sku.attrs))).size > 1) {
      conflicts.push({
        key,
        reason: 'variações de tipos diferentes (uns com cor/tamanho, outros sem)',
        names,
      });
      sorted.forEach(solo);
      continue;
    }
    if (new Set(skus.map((sku) => tupleKey(sku.attrs))).size < skus.length) {
      conflicts.push({
        key,
        reason: 'duas variações iguais (mesma cor e tamanho): provável duplicado',
        names,
      });
      sorted.forEach(solo);
      continue;
    }
    const survivor = sorted[0] as Entry;
    changes.push({
      survivorId: survivor.product.product_id,
      donorIds: sorted.slice(1).map((entry) => entry.product.product_id),
      name: survivor.style.base,
      skus,
    });
  }
  return { changes, conflicts };
}
