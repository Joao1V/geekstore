import type { RowDraft } from './plan-item';
import { COLOR_CODES } from './sku-code';

// Só vestuário tem tamanho no nome de forma confiável (PP, GG, 33/35...). Outros grupos ficam
// como produto simples até o cliente aprovar estender.
const VARIANT_GROUPS = new Set(['Vestuário']);
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
const COLORS = Object.keys(COLOR_CODES).sort((a, b) => b.split(' ').length - a.split(' ').length);

export type ParsedVariant = {
  baseName: string;
  attributes: { cor?: string; tamanho: string };
};

function isSize(token: string, isKids: boolean): boolean {
  const upper = token.toUpperCase();
  return SIZES.has(upper) || RANGE.test(upper) || (isKids && KIDS_SIZE.test(upper));
}

function takeColor(tokens: string[]): { rest: string[]; color?: string } {
  const upper = tokens.map((token) => token.toUpperCase());
  for (const color of COLORS) {
    const words = color.split(' ');
    const at = upper.findIndex((_, i) => words.every((word, k) => upper[i + k] === word));
    if (at >= 0) {
      const found = tokens.slice(at, at + words.length).join(' ');
      return { rest: [...tokens.slice(0, at), ...tokens.slice(at + words.length)], color: found };
    }
  }
  return { rest: tokens };
}

/** "Camiseta Naruto Kunai Preto GG" -> base "Camiseta Naruto Kunai", cor Preto, tamanho GG. */
export function parseVariant(name: string, groupName: string): ParsedVariant | null {
  if (!VARIANT_GROUPS.has(groupName)) return null;
  const tokens = name.replace(/#\d+/g, '').split(/\s+/).filter(Boolean);
  const isKids = tokens.some((token) => token.toUpperCase() === 'INF');
  const sizeTokens = tokens.filter((token) => isSize(token, isKids));
  if (sizeTokens.length === 0) return null;

  const withoutSize = tokens.filter(
    (token) => !isSize(token, isKids) && !SIZE_LABELS.has(token.toUpperCase())
  );
  const { rest, color } = takeColor(withoutSize);
  const baseName = rest.join(' ').trim();
  if (!baseName) return null;
  return {
    baseName,
    attributes: { ...(color ? { cor: color } : {}), tamanho: sizeTokens.join(' ').toUpperCase() },
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
  `${attributes.cor ?? ''}|${attributes.tamanho ?? ''}`.toUpperCase();

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
