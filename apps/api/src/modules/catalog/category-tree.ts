import { BadRequestError } from '../../core/_errors';

/** Profundidade máxima da árvore de categorias (RF-CAT-05). */
export const MAX_CATEGORY_DEPTH = 3;

export type CategoryNode = { category_id: string; parent_id: string | null };

/** Nível de uma categoria: raiz = 1. Lança se houver ciclo ou pai inexistente no mapa. */
export function depthOf(
  categoryId: string,
  parentById: ReadonlyMap<string, string | null>
): number {
  let depth = 1;
  let cursor = parentById.get(categoryId);
  const seen = new Set<string>([categoryId]);

  while (cursor) {
    if (seen.has(cursor)) throw new BadRequestError('Ciclo detectado na árvore de categorias.');
    seen.add(cursor);
    depth += 1;
    cursor = parentById.get(cursor);
  }
  return depth;
}

/** Altura da subárvore de `categoryId` contando o próprio nó: folha = 1. */
export function subtreeHeight(categoryId: string, nodes: readonly CategoryNode[]): number {
  const children = nodes.filter((node) => node.parent_id === categoryId);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((child) => subtreeHeight(child.category_id, nodes)));
}

/**
 * Valida colocar `categoryId` (ou uma categoria nova, `categoryId = null`) sob `parentId`:
 * o pai existe, não é a própria categoria nem um descendente dela, e a árvore resultante
 * (novo nível + altura da subárvore movida) não passa de `MAX_CATEGORY_DEPTH`.
 */
export function assertValidPlacement(
  nodes: readonly CategoryNode[],
  categoryId: string | null,
  parentId: string | null
): void {
  if (parentId === null) return;

  const parentById = new Map(nodes.map((node) => [node.category_id, node.parent_id]));
  if (!parentById.has(parentId)) throw new BadRequestError('Categoria pai não encontrada.');

  if (categoryId !== null) {
    if (categoryId === parentId) {
      throw new BadRequestError('Uma categoria não pode ser pai de si mesma.');
    }
    // Sobe a partir do pai: se encontrar `categoryId`, o pai é um descendente dela.
    let cursor: string | null | undefined = parentId;
    while (cursor) {
      if (cursor === categoryId) {
        throw new BadRequestError('Uma categoria não pode ser movida para dentro de si mesma.');
      }
      cursor = parentById.get(cursor);
    }
  }

  const parentDepth = depthOf(parentId, parentById);
  const ownHeight = categoryId === null ? 1 : subtreeHeight(categoryId, nodes);
  if (parentDepth + ownHeight > MAX_CATEGORY_DEPTH) {
    throw new BadRequestError(`A árvore de categorias tem no máximo ${MAX_CATEGORY_DEPTH} níveis.`);
  }
}
