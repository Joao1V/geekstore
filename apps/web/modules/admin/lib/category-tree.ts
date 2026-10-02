import type { Category } from '@geekstore/shared';

import type { FieldSelectOption } from '@/components/ui/field-select';

export const MAX_CATEGORY_DEPTH = 3;

export type CategoryNode = { category: Category; depth: number; children: CategoryNode[] };

function sortByPosition(a: Category, b: Category) {
  return a.position - b.position || a.name.localeCompare(b.name, 'pt-BR');
}

/** Monta a árvore a partir da lista plana (`parent_id`); depth começa em 1. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const siblings = byParent.get(category.parent_id) ?? [];
    byParent.set(category.parent_id, [...siblings, category]);
  }
  const build = (parentId: string | null, depth: number): CategoryNode[] =>
    (byParent.get(parentId) ?? []).sort(sortByPosition).map((category) => ({
      category,
      depth,
      children: build(category.category_id, depth + 1),
    }));
  return build(null, 1);
}

export function flattenTree(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Ids da categoria e de todos os descendentes (não podem ser o pai dela mesma). */
export function subtreeIds(nodes: CategoryNode[], categoryId: string): Set<string> {
  const found = flattenTree(nodes).find((node) => node.category.category_id === categoryId);
  return new Set(found ? flattenTree([found]).map((node) => node.category.category_id) : []);
}

/** Altura da subárvore (1 = sem filhos). */
export function subtreeHeight(node: CategoryNode): number {
  return 1 + Math.max(0, ...node.children.map(subtreeHeight));
}

function optionsBelow(
  nodes: CategoryNode[],
  trail: string[],
  group: string,
  isAllowed: (node: CategoryNode) => boolean
): FieldSelectOption[] {
  return nodes.flatMap((node) => {
    const path = [...trail, node.category.name];
    const own = isAllowed(node)
      ? [
          {
            value: node.category.category_id,
            label: path.join(' › '),
            textValue: [group, ...path].join(' › '),
            group,
          },
        ]
      : [];
    return [...own, ...optionsBelow(node.children, path, group, isAllowed)];
  });
}

/**
 * Opções de select agrupadas pela categoria raiz: cada raiz vira um cabeçalho, e dentro dele vêm a
 * própria raiz e as descendentes (o 3º nível aparece como "Funko › Marvel").
 */
export function groupedCategoryOptions(
  tree: CategoryNode[],
  isAllowed: (node: CategoryNode) => boolean = () => true
): FieldSelectOption[] {
  return tree.flatMap((root) => {
    const group = root.category.name;
    const own = isAllowed(root) ? [{ value: root.category.category_id, label: group, group }] : [];
    return [...own, ...optionsBelow(root.children, [], group, isAllowed)];
  });
}

export type CategoryLabel = { name: string; parent: string | null };

/** `category_id -> { nome, nome do pai }`: a lista mostra "Brinquedos › Jogos de Tabuleiro". */
export function categoryLabels(categories: Category[]): Map<string, CategoryLabel> {
  const nameById = new Map(categories.map((category) => [category.category_id, category.name]));
  return new Map(
    categories.map((category) => [
      category.category_id,
      {
        name: category.name,
        parent: category.parent_id ? (nameById.get(category.parent_id) ?? null) : null,
      },
    ])
  );
}
