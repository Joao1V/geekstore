import { prisma } from '@geekstore/db';

// Endereços da loja no padrão da Tray: a categoria é o caminho de slugs da raiz até ela
// (`/colecionaveis/funko/`) e o produto é esse caminho + o slug dele (`/colecionaveis/funko/<slug>/`).
// A árvore de categorias é pequena (dezenas de nós) e muda pouco: fica em memória por um minuto.

const TTL_MS = 60_000;

type Node = { category_id: string; parent_id: string | null; slug: string };

export type CategoryPaths = {
  /** `/a/b/` da categoria. */
  categoryPath: (categoryId: string) => string;
  /** `/a/b/<slug>/` do produto. */
  productPath: (categoryId: string, productSlug: string) => string;
  /** Categoria cujo caminho completo é exatamente estes slugs. */
  idOfChain: (segments: readonly string[]) => string | null;
  /** Categoria cujo ÚLTIMO slug é este (para achar a canônica quando o caminho veio errado). */
  idOfSlug: (slug: string) => string | null;
};

export function buildCategoryPaths(nodes: readonly Node[]): CategoryPaths {
  const byId = new Map(nodes.map((node) => [node.category_id, node]));
  const chainOf = (categoryId: string): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(categoryId);
    while (current && !seen.has(current.category_id)) {
      seen.add(current.category_id);
      chain.unshift(current.slug);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return chain;
  };
  const byChain = new Map(
    nodes.map((node) => [chainOf(node.category_id).join('/'), node.category_id])
  );
  const bySlug = new Map(nodes.map((node) => [node.slug, node.category_id]));
  const categoryPath = (categoryId: string): string => `/${chainOf(categoryId).join('/')}/`;
  return {
    categoryPath,
    productPath: (categoryId, productSlug) => `${categoryPath(categoryId)}${productSlug}/`,
    idOfChain: (segments) => byChain.get(segments.join('/')) ?? null,
    idOfSlug: (slug) => bySlug.get(slug) ?? null,
  };
}

let cache: { at: number; paths: CategoryPaths } | null = null;

export async function categoryPaths(now = Date.now()): Promise<CategoryPaths> {
  if (cache && now - cache.at < TTL_MS) return cache.paths;
  const nodes = await prisma.category.findMany({
    select: { category_id: true, parent_id: true, slug: true },
  });
  cache = { at: now, paths: buildCategoryPaths(nodes) };
  return cache.paths;
}
