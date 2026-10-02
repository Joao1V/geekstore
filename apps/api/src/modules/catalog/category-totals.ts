type CategoryCount = {
  category_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  _count: { products: number };
};

/** Categorias raiz com o total de produtos de cada uma, contando todas as subcategorias. */
export function rootCategoryTotals(categories: readonly CategoryCount[]) {
  const children = new Map<string | null, CategoryCount[]>();
  for (const category of categories) {
    children.set(category.parent_id, [...(children.get(category.parent_id) ?? []), category]);
  }
  const total = (category: CategoryCount): number =>
    category._count.products +
    (children.get(category.category_id) ?? []).reduce((sum, child) => sum + total(child), 0);

  return (children.get(null) ?? [])
    .map((root) => ({
      category_id: root.category_id,
      name: root.name,
      product_count: total(root),
      position: root.position,
    }))
    .filter((root) => root.product_count > 0)
    .sort((a, b) => b.product_count - a.product_count || a.position - b.position)
    .map(({ category_id, name, product_count }) => ({ category_id, name, product_count }));
}
