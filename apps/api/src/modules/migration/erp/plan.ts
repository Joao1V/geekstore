import type { ErpRow } from './erp-row';
import { categoryKeyFor, planCategories } from './plan-categories';
import { planRow } from './plan-item';
import type { CatalogPlan, Issue, PlannedItem, PlanOptions } from './plan-types';
import { groupVariants, type ProductGroup } from './plan-variants';
import { familyPrefix, groupPrefix, MAX_PREFIX_WORDS, variantCode } from './sku-code';
import { slugify } from './text';

type Built = { items: PlannedItem[]; issues: Issue[] };

type Used = { slugs: Set<string>; skuCodes: Set<string>; prefixes: Set<string> };

/** Primeiro uso fica com o slug limpo; repetidos ganham `-<codigo>`. Slug do banco nunca se repete. */
function uniqueSlug(base: string, legacyCode: string, used: Set<string>): string {
  let slug = used.has(base) ? `${base}-${legacyCode}` : base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${legacyCode}-${n}`;
  used.add(slug);
  return slug;
}

function uniqueCode(base: string, used: Set<string>): string {
  let code = base;
  for (let n = 2; used.has(code); n++) code = `${base}-${n}`;
  used.add(code);
  return code;
}

/**
 * Prefixo da família sem repetir o de outra: tenta NAR-KUN, depois com mais palavras do nome
 * (NAR-KUN-ZER) e só então numera (NAR-KUN2).
 */
function uniquePrefix(name: string, used: Set<string>): string {
  const base = familyPrefix(name);
  for (let words = 3; words <= MAX_PREFIX_WORDS; words++) {
    const candidate = familyPrefix(name, words);
    if (!used.has(base)) break;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  let prefix = base;
  for (let n = 2; used.has(prefix); n++) prefix = `${base}${n}`;
  used.add(prefix);
  return prefix;
}

function buildGroup(group: ProductGroup, used: Used): Built {
  const first = group.members[0]!.draft.item;
  const isFamily = group.baseName !== null;
  const name = group.baseName ?? first.name;
  const baseSlug = isFamily ? slugify(name) || `produto-${first.legacyCode}` : first.baseSlug;
  const slug = uniqueSlug(baseSlug, first.legacyCode, used.slugs);
  const slugCollided = !isFamily && slug !== baseSlug;

  const skus = group.members.map((m) => m.draft.item);
  const photos = [...new Set(skus.flatMap((sku) => sku.photos))];
  const hasActiveSku = skus.some((sku) => sku.skuStatus === 'active');
  const productStatus = hasActiveSku && photos.length > 0 ? 'active' : 'draft';
  const description = skus.map((sku) => sku.description).find(Boolean) ?? null;
  const brandName = skus.map((sku) => sku.brandName).find(Boolean) ?? null;
  const categoryKey = categoryKeyFor({ groupName: first.groupName, subName: first.subName });
  const prefix = isFamily ? uniquePrefix(name, used.prefixes) : groupPrefix(first.groupName);

  const items = group.members.map(({ draft, attributes }): PlannedItem => {
    const { baseSlug: _slug, groupName: _group, subName: _sub, ...rest } = draft.item;
    const code = isFamily ? variantCode(prefix, attributes) : `${prefix}-${rest.legacyCode}`;
    const skuCode = uniqueCode(code, used.skuCodes);
    return {
      ...rest,
      skuCode,
      productKey: group.key,
      productCode: isFamily ? prefix : skuCode,
      attributes,
      erpName: rest.name,
      name,
      slug,
      description,
      brandName,
      categoryKey,
      productStatus,
      photos,
    };
  });

  const extra: Issue[] = [
    ...(slugCollided
      ? [{ legacyCode: first.legacyCode, code: 'slug_collision' as const, detail: baseSlug }]
      : []),
    ...(group.ambiguous
      ? [{ legacyCode: first.legacyCode, code: 'variant_ambiguous' as const, detail: name }]
      : []),
  ];
  return { items, issues: [...group.members.flatMap((m) => m.draft.issues), ...extra] };
}

function findDuplicateEans(items: PlannedItem[]): CatalogPlan['duplicateEans'] {
  const byEan = items.reduce((map, item) => {
    if (!item.ean) return map;
    return map.set(item.ean, [...(map.get(item.ean) ?? []), item.legacyCode]);
  }, new Map<string, string[]>());
  return [...byEan]
    .filter(([, codes]) => codes.length > 1)
    .map(([ean, legacyCodes]) => ({ ean, legacyCodes }));
}

/** Linhas do ERP -> plano de importação (categorias, itens, pulados e pendências). Função pura. */
export function buildPlan(rows: ErpRow[], options: PlanOptions): CatalogPlan {
  const results = [...rows]
    .sort((a, b) => a.codigo - b.codigo)
    .map((row) => planRow(row, options.now));
  const skipped = results.flatMap((result) => ('skipped' in result ? [result.skipped] : []));
  const drafts = results.flatMap((result) => ('draft' in result ? [result.draft] : []));

  const categories = planCategories(
    drafts.map(({ item }) => ({ groupName: item.groupName, subName: item.subName })),
    options.takenCategorySlugs
  );
  const used: Used = {
    slugs: new Set(options.takenSlugs),
    skuCodes: new Set(options.takenSkuCodes),
    prefixes: new Set(options.takenProductCodes),
  };
  const built = groupVariants(drafts).map((group) => buildGroup(group, used));
  const items = built.flatMap((b) => b.items);
  const duplicateEans = findDuplicateEans(items);
  const duplicateIssues = duplicateEans.flatMap(({ ean, legacyCodes }) =>
    legacyCodes.map(
      (legacyCode): Issue => ({
        legacyCode,
        code: 'ean_duplicate',
        detail: `${ean} (${legacyCodes.length} itens)`,
      })
    )
  );

  return {
    categories,
    items,
    skipped,
    issues: [...built.flatMap((b) => b.issues), ...duplicateIssues],
    duplicateEans,
  };
}
