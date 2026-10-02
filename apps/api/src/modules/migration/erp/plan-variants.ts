import type { RowDraft } from './plan-item';

// Vestuário tem tamanho e numeração no nome (PP, GG, 33/35...). Nos demais grupos só se agrupa
// quando a palavra que muda é de um tipo conhecido (cor, sabor, medida, tamanho por extenso):
// "Spy X Family Vol 07" e "Vol 11" são produtos diferentes, não variações.
const CLOTHING_GROUP = 'Vestuário';
const FLAVOR_GROUP = 'Alimentos e Bebidas';
const FLAVORS = new Set([
  'MORANGO',
  'UVA',
  'LARANJA',
  'CHOCOLATE',
  'PESSEGO',
  'LIMAO',
  'BAUNILHA',
  'MACA',
  'MARACUJA',
  'MANGA',
  'LEITE',
  'ORIGINAL',
  'CHURRASCO',
  'ABACAXI',
  'COCO',
  'CEREJA',
  'MENTA',
  'CARAMELO',
]);
const NAMED_SIZES = new Set(['A4', 'A5', 'PEQUENO', 'MEDIO', 'GRANDE']);
const WEIGHT = /^\d+(?:[.,]\d+)?(?:G|KG|MG)$/i;
const VOLUME = /^\d+(?:[.,]\d+)?(?:ML|L)$/i;
// Palavras de cor que aparecem no nome (as duas formas de gênero; o valor guardado é uma só).
const COLOR_WORDS = [
  'AZUL MARINHO',
  'OFF WHITE',
  'PRETO',
  'PRETA',
  'BRANCO',
  'BRANCA',
  'AZUL',
  'VERMELHO',
  'VERMELHA',
  'LARANJA',
  'VINHO',
  'VERDE',
  'AMARELO',
  'AMARELA',
  'ROSA',
  'CINZA',
  'ROXO',
  'ROXA',
  'MARROM',
  'CARBONO',
  'BEGE',
  'DOURADO',
  'PRATA',
  'LILAS',
  'TRANSPARENTE',
  'TRANSLUCIDO',
  'MARFIM',
  'GRAFITE',
];
const SIZES = new Set([
  'PP',
  'P',
  'M',
  'G',
  'GG',
  'XG',
  'XGG',
  'EXG',
  'XL',
  'XXL',
  'G1',
  'G2',
  'G3',
]);
// Rótulos que acompanham o tamanho no nome ("... Verde Tamanho P") e não fazem parte do produto.
const SIZE_LABELS = new Set(['TAMANHO', 'TAM', 'TAM.']);
const RANGE = /^\d{2}\/\d{2}$/;
const KIDS_SIZE = /^\d{2}$/;
// Cores de duas palavras primeiro, para "AZUL MARINHO" não virar "AZUL".
const COLORS = [...COLOR_WORDS].sort((a, b) => b.split(' ').length - a.split(' ').length);

export type ParsedVariant = {
  baseName: string;
  /** Código do atributo -> rótulo do valor ({ cor: 'Preto', tamanho: 'GG' }). */
  attributes: Record<string, string>;
};

function isSize(token: string, isKids: boolean): boolean {
  const upper = token.toUpperCase();
  return SIZES.has(upper) || RANGE.test(upper) || (isKids && KIDS_SIZE.test(upper));
}

// Uma cor só, no masculino: "Preta" e "Preto" são o mesmo valor do atributo.
const FEMININE_TO_MASCULINE: Record<string, string> = {
  PRETA: 'PRETO',
  BRANCA: 'BRANCO',
  VERMELHA: 'VERMELHO',
  AMARELA: 'AMARELO',
  ROXA: 'ROXO',
};

function canonicalColor(color: string): string {
  const upper = FEMININE_TO_MASCULINE[color] ?? color;
  return upper
    .split(' ')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function takeColor(tokens: string[]): { rest: string[]; color?: string } {
  const upper = tokens.map((token) => token.toUpperCase());
  for (const color of COLORS) {
    const words = color.split(' ');
    const at = upper.findIndex((_, i) => words.every((word, k) => upper[i + k] === word));
    if (at >= 0) {
      return {
        rest: [...tokens.slice(0, at), ...tokens.slice(at + words.length)],
        color: canonicalColor(color),
      };
    }
  }
  return { rest: tokens };
}

const titleCase = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** Fora do vestuário: cor, sabor, medida ("325ML") e tamanho por extenso ("Grande"). */
function parseGeneric(tokens: string[], groupName: string): ParsedVariant | null {
  const found: Record<string, string> = {};
  let rest = tokens;

  const weight = rest.find((token) => WEIGHT.test(token));
  if (weight) {
    found.peso = weight.toLowerCase();
    rest = rest.filter((token) => token !== weight);
  }
  const volume = rest.find((token) => VOLUME.test(token));
  if (volume) {
    found.capacidade = volume.toLowerCase();
    rest = rest.filter((token) => token !== volume);
  }
  const named = rest.find((token) => NAMED_SIZES.has(token.toUpperCase()));
  if (named) {
    found.tamanho = titleCase(named);
    rest = rest.filter((token) => token !== named);
  }
  const flavor =
    groupName === FLAVOR_GROUP ? rest.find((token) => FLAVORS.has(token.toUpperCase())) : undefined;
  if (flavor) {
    found.sabor = titleCase(flavor);
    rest = rest.filter((token) => token !== flavor);
  }
  const { rest: withoutColor, color } = takeColor(rest);
  if (color) found.cor = color;

  const baseName = withoutColor.join(' ').trim();
  return Object.keys(found).length > 0 && baseName ? { baseName, attributes: found } : null;
}

/** "Camiseta Naruto Kunai Preto GG" -> base "Camiseta Naruto Kunai", cor Preto, tamanho GG. */
export function parseVariant(name: string, groupName: string): ParsedVariant | null {
  const tokens = name.replace(/#\d+/g, '').split(/\s+/).filter(Boolean);
  if (groupName !== CLOTHING_GROUP) return parseGeneric(tokens, groupName);
  const isKids = tokens.some((token) => token.toUpperCase() === 'INF');
  const sizeTokens = tokens.filter((token) => isSize(token, isKids));
  if (sizeTokens.length === 0) return null;

  const withoutSize = tokens.filter(
    (token) => !isSize(token, isKids) && !SIZE_LABELS.has(token.toUpperCase())
  );
  const { rest, color } = takeColor(withoutSize);
  const baseName = rest.join(' ').trim();
  if (!baseName) return null;
  const sizes = sizeTokens.map((token) => token.toUpperCase());
  const numeracao = sizes.find((size) => RANGE.test(size));
  const kids = sizes.find((size) => KIDS_SIZE.test(size));
  const tamanho = sizes.filter((size) => !RANGE.test(size) && !KIDS_SIZE.test(size)).join(' ');
  return {
    baseName,
    attributes: {
      ...(color ? { cor: color } : {}),
      ...(tamanho ? { tamanho } : {}),
      ...(kids ? { tamanho_infantil: String(Number(kids)) } : {}),
      ...(numeracao ? { numeracao } : {}),
    },
  };
}

export type ProductGroup = {
  key: string;
  /** `null` = produto simples (um item, sem variação). */
  baseName: string | null;
  members: { draft: RowDraft; attributes: Record<string, string> }[];
  ambiguous: boolean;
};

const attributesKey = (attributes: Record<string, string>) =>
  JSON.stringify(Object.entries(attributes).sort()).toUpperCase();

/**
 * Junta em um produto os itens do ERP que diferem só por cor e tamanho. Uma família com duas
 * variações iguais (mesma cor e tamanho) não é agrupada: vai para revisão em vez de chutar.
 */
export function groupVariants(drafts: RowDraft[]): ProductGroup[] {
  const families = new Map<string, { baseName: string; members: ProductGroup['members'] }>();
  const singles: ProductGroup[] = [];

  for (const draft of drafts) {
    const parsed = parseVariant(draft.item.name, draft.item.groupName);
    if (!parsed) {
      singles.push(single(draft, false));
      continue;
    }
    const key = `${draft.item.groupName}|${draft.item.subName ?? ''}|${parsed.baseName.toLowerCase()}`;
    const family = families.get(key) ?? { baseName: parsed.baseName, members: [] };
    family.members.push({ draft, attributes: parsed.attributes });
    families.set(key, family);
  }

  const grouped: ProductGroup[] = [];
  for (const [key, family] of families) {
    const distinct = new Set(family.members.map((m) => attributesKey(m.attributes)));
    if (family.members.length < 2) {
      singles.push(single(family.members[0]!.draft, false));
    } else if (!key.startsWith(`${CLOTHING_GROUP}|`) && !sameKinds(family.members)) {
      // Fora do vestuário, um com cor e outro sem não é variação clara: fica como produtos simples.
      singles.push(...family.members.map((m) => single(m.draft, false)));
    } else if (distinct.size < family.members.length) {
      singles.push(...family.members.map((m) => single(m.draft, true)));
    } else {
      grouped.push({
        key: `family:${key}`,
        baseName: family.baseName,
        members: family.members,
        ambiguous: false,
      });
    }
  }
  return [...grouped, ...singles].sort((a, b) =>
    a.members[0]!.draft.item.legacyCode.localeCompare(b.members[0]!.draft.item.legacyCode, 'en', {
      numeric: true,
    })
  );
}

function single(draft: RowDraft, ambiguous: boolean): ProductGroup {
  return {
    key: `item:${draft.item.legacyCode}`,
    baseName: null,
    members: [{ draft, attributes: {} }],
    ambiguous,
  };
}

const kindsOf = (attributes: Record<string, string>) => Object.keys(attributes).sort().join(',');

function sameKinds(members: ProductGroup['members']): boolean {
  return new Set(members.map((m) => kindsOf(m.attributes))).size === 1;
}
