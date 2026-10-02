import type { PlannedCategory } from './plan-types';
import { slugify } from './text';

type CategoryInput = { groupName: string; subName: string | null };

const byName = (a: string, b: string) => a.localeCompare(b, 'pt-BR');
const groupKey = (group: string) => `g:${group}`;
const subKey = (group: string, sub: string) => `s:${group}/${sub}`;

/** Subgrupo igual ao grupo (ex.: "Uso e Consumo > Uso e Consumo") não vira um segundo nível. */
function effectiveSub(input: CategoryInput): string | null {
  const { groupName, subName } = input;
  return subName && subName.toLowerCase() !== groupName.toLowerCase() ? subName : null;
}

/** Chave da categoria onde o item cai: o subgrupo quando existe, senão o grupo. */
export function categoryKeyFor(input: CategoryInput): string {
  const sub = effectiveSub(input);
  return sub ? subKey(input.groupName, sub) : groupKey(input.groupName);
}

function uniqueSlug(candidate: string, used: Set<string>): string {
  const base = candidate || 'categoria';
  const slug = [base, ...Array.from({ length: 50 }, (_, i) => `${base}-${i + 2}`)].find(
    (s) => !used.has(s)
  );
  const chosen = slug ?? `${base}-${used.size}`;
  used.add(chosen);
  return chosen;
}

/**
 * Árvore de 2 níveis a partir de grupo/subgrupo. O slug do subgrupo é o nome limpo quando só existe
 * um com esse nome; se o mesmo nome aparece em grupos diferentes (ex.: "Boneco"), ganha o slug do
 * grupo na frente. Os slugs nunca repetem os já usados no banco.
 */
export function planCategories(
  inputs: CategoryInput[],
  takenSlugs: ReadonlySet<string> = new Set()
): PlannedCategory[] {
  const groups = [...new Set(inputs.map((input) => input.groupName))].sort(byName);
  const subsByGroup = new Map(
    groups.map((group) => [
      group,
      [
        ...new Set(
          inputs.filter((i) => i.groupName === group).flatMap((i) => effectiveSub(i) ?? [])
        ),
      ].sort(byName),
    ])
  );
  const subSlugCount = new Map<string, number>();
  for (const subs of subsByGroup.values()) {
    for (const sub of subs)
      subSlugCount.set(slugify(sub), (subSlugCount.get(slugify(sub)) ?? 0) + 1);
  }

  const used = new Set(takenSlugs);
  const counts = inputs.reduce(
    (map, input) => map.set(categoryKeyFor(input), (map.get(categoryKeyFor(input)) ?? 0) + 1),
    new Map<string, number>()
  );

  return groups.flatMap((group, groupIndex) => {
    const groupSlug = uniqueSlug(slugify(group), used);
    const parent: PlannedCategory = {
      key: groupKey(group),
      parentKey: null,
      name: group,
      slug: groupSlug,
      position: groupIndex,
      productCount: counts.get(groupKey(group)) ?? 0,
    };
    const children = (subsByGroup.get(group) ?? []).map((sub, subIndex): PlannedCategory => {
      const own = slugify(sub);
      const candidate =
        (subSlugCount.get(own) ?? 0) > 1 || used.has(own) ? `${groupSlug}-${own}` : own;
      return {
        key: subKey(group, sub),
        parentKey: parent.key,
        name: sub,
        slug: uniqueSlug(candidate, used),
        position: subIndex,
        productCount: counts.get(subKey(group, sub)) ?? 0,
      };
    });
    return [parent, ...children];
  });
}
