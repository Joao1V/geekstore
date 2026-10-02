import type { ErpRow } from './erp-row';
import { categoryKeyFor, planCategories } from './plan-categories';
import { planRow, type RowDraft } from './plan-item';
import type { CatalogPlan, Issue, PlannedItem, PlanOptions } from './plan-types';

type Slugged = { item: PlannedItem; issues: Issue[] };

/** Primeiro código fica com o slug limpo; repetidos ganham `-<codigo>`. Slug do banco nunca se repete. */
function assignSlugs(drafts: RowDraft[], takenSlugs: ReadonlySet<string>): Slugged[] {
  const used = new Set(takenSlugs);
  return drafts.map((draft) => {
    const { baseSlug, groupName, subName, ...rest } = draft.item;
    const collides = used.has(baseSlug);
    let slug = collides ? `${baseSlug}-${rest.legacyCode}` : baseSlug;
    for (let n = 2; used.has(slug); n++) slug = `${baseSlug}-${rest.legacyCode}-${n}`;
    used.add(slug);

    const issues: Issue[] = collides
      ? [...draft.issues, { legacyCode: rest.legacyCode, code: 'slug_collision', detail: baseSlug }]
      : draft.issues;
    return { item: { ...rest, slug, categoryKey: categoryKeyFor({ groupName, subName }) }, issues };
  });
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
  const slugged = assignSlugs(drafts, options.takenSlugs ?? new Set());
  const items = slugged.map(({ item }) => item);
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
    issues: [...slugged.flatMap(({ issues }) => issues), ...duplicateIssues],
    duplicateEans,
  };
}
