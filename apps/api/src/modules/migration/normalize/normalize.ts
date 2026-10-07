import { categoryNode } from '@geekstore/db';

import { formatBaseCode, skuCodeOf } from '../../catalog/sku-codes';
import type { CatalogPlan, PlannedItem } from '../erp/plan-types';
import { parseVariant } from '../erp/plan-variants';
import { slugify } from '../erp/text';
import { restoreAccents } from './accents';
import type { LegacyMapEntry, NormalizedCatalog, NormalizedProduct } from './catalog-file';
import { detectFranchise } from './franchise';

import { plainUpper } from './text';

export type NormalizeOptions = {
  now: Date;
  sourceSha256: string;
  /** Só estas categorias (piloto). `null` = todas. */
  scope: readonly string[] | null;
  /** Último número já usado por tipo (CNC -> 42): a numeração continua dali. */
  startAfter?: Readonly<Record<string, number>>;
};

export type ReviewRow = { sku_code: string; name: string; reasons: string[] };

export type NormalizeResult = {
  catalog: NormalizedCatalog;
  legacyMap: LegacyMapEntry[];
  review: ReviewRow[];
  /** Maior número usado por tipo, para gravar no contador do banco. */
  lastNumbers: Record<string, number>;
};

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

function groupByProduct(items: PlannedItem[]): PlannedItem[][] {
  const groups = new Map<string, PlannedItem[]>();
  for (const item of items)
    groups.set(item.productKey, [...(groups.get(item.productKey) ?? []), item]);
  return [...groups.values()];
}

/**
 * Endereço público do produto: o nome, e "-2", "-3"... se já existe. O plano do ERP resolve colisão com o
 * código do ERP no fim; aqui isso não vale, porque o código do ERP nunca aparece na loja.
 */
function uniqueSlug(name: string, baseCode: string, used: Set<string>): string {
  const base = slugify(name) || baseCode.toLowerCase();
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  used.add(slug);
  return slug;
}

// "e-Commerce" no fim do nome é marcação interna do ERP (item liberado para a loja), não faz parte do produto.
const ERP_MARKERS = /\s*[-–]?\s*\be-commerce\b/gi;

export const cleanProductName = (name: string): string =>
  restoreAccents(name.replace(ERP_MARKERS, ''))
    .replace(/\s{2,}/g, ' ')
    .trim();

const SIZE_ATTRIBUTES = ['tamanho', 'tamanho_infantil', 'numeracao'];

/**
 * Produto que sobrou com um tamanho só (as outras numerações não existem no ERP): o tamanho é
 * atributo do SKU, não parte do título ("Pijama Starlit Azul Tamanho 6" -> "Pijama Starlit Azul").
 */
function titleOf(item: PlannedItem, group: readonly PlannedItem[]): string {
  if (group.length > 1 || !SIZE_ATTRIBUTES.some((code) => code in item.attributes))
    return item.name;
  const parsed = parseVariant(item.name, categoryNode(item.categoryKey).rootSlug);
  if (!parsed) return item.name;
  const color = parsed.attributes.cor;
  return color ? `${parsed.baseName} ${color}` : parsed.baseName;
}

/**
 * Variações de uma cor só: a cor não é escolha do cliente, então volta ao nome do produto
 * ("Pijama Starlit" + Azul -> "Pijama Starlit Azul"). O atributo continua no SKU.
 */
export function nameWithSharedColor(name: string, group: readonly PlannedItem[]): string {
  const colors = new Set(group.map((item) => item.attributes.cor));
  const [only] = [...colors];
  if (group.length < 2 || colors.size !== 1 || !only) return name;
  return plainUpper(name).includes(plainUpper(only)) ? name : `${name} ${only}`;
}

/** Itens do ERP já planejados (categorias, famílias, atributos) -> catálogo com SKUs sequenciais. */
export function normalizePlan(plan: CatalogPlan, options: NormalizeOptions): NormalizeResult {
  const inScope = options.scope
    ? plan.items.filter((item) => options.scope?.includes(item.categoryKey))
    : plan.items;
  const issuesByLegacy = new Map<string, string[]>();
  for (const issue of plan.issues) {
    issuesByLegacy.set(issue.legacyCode, [
      ...(issuesByLegacy.get(issue.legacyCode) ?? []),
      issue.code,
    ]);
  }

  const counters = new Map<string, number>(Object.entries(options.startAfter ?? {}));
  const seenCodes = new Set<string>();
  const seenSlugs = new Set<string>();
  const products: NormalizedProduct[] = [];
  const legacyMap: LegacyMapEntry[] = [];
  const review: ReviewRow[] = [];

  for (const group of groupByProduct(inScope)) {
    const first = group[0]!;
    const type = (categoryNode(first.categoryKey).prefix ?? 'GEN').toUpperCase();
    const next = (counters.get(type) ?? 0) + 1;
    counters.set(type, next);
    const baseCode = formatBaseCode(type, next);
    const franchise = detectFranchise(plainUpper(first.name));
    const displayName = nameWithSharedColor(cleanProductName(titleOf(first, group)), group);

    const skus = group.map((item) => {
      const code = skuCodeOf(baseCode, item.attributes);
      if (seenCodes.has(code)) throw new Error(`SKU repetido dentro do arquivo: ${code}`);
      seenCodes.add(code);
      legacyMap.push({ sku_code: code, erp_code: item.legacyCode, erp_name: item.erpName });
      const reasons = [
        ...(item.categoryHow === 'erp' ? ['categoria pela pista do ERP (confira)'] : []),
        ...(issuesByLegacy.get(item.legacyCode) ?? []).filter((reason) =>
          ['variant_ambiguous', 'ean_duplicate', 'slug_collision'].includes(reason)
        ),
      ];
      if (reasons.length > 0) review.push({ sku_code: code, name: item.name, reasons });
      return {
        code,
        ean: item.ean,
        manufacturer_code: item.manufacturerCode,
        ncm: item.ncm,
        weight_g: item.weightG,
        length_mm: item.lengthMm,
        width_mm: item.widthMm,
        height_mm: item.heightMm,
        price_cents: item.priceCents,
        promo: item.promo
          ? {
              price_cents: item.promo.priceCents,
              compare_at_cents: item.promo.compareAtCents,
              starts_at: iso(item.promo.startsAt),
              ends_at: iso(item.promo.endsAt),
            }
          : null,
        stock: item.stock,
        status: item.skuStatus,
        attributes: item.attributes,
        photos: item.ownPhotos,
      };
    });

    products.push({
      code: baseCode,
      name: displayName,
      slug: uniqueSlug(displayName, baseCode, seenSlugs),
      description: first.description,
      category: first.categoryKey,
      brand: first.brandName,
      collections: franchise ? [franchise.franchise.slug] : [],
      status: first.productStatus,
      has_variants: first.hasVariants,
      photos: first.photos,
      skus,
    });
  }

  return {
    catalog: {
      format: 1,
      generated_at: options.now.toISOString(),
      source_sha256: options.sourceSha256,
      scope: options.scope ? [...options.scope] : null,
      products,
    },
    legacyMap,
    review,
    lastNumbers: Object.fromEntries(counters),
  };
}
