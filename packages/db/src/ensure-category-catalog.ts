import type { PrismaClient } from '../generated/client/index.js';
import { CATEGORY_CATALOG, type CategorySeed } from './category-catalog';

type Db = Pick<PrismaClient, 'category' | 'attribute' | 'categoryAttribute'>;

async function ensureCategory(
  db: Db,
  seed: CategorySeed,
  parentId: string | null,
  position: number
): Promise<{ id: string; created: boolean }> {
  const found = await db.category.findUnique({
    where: { slug: seed.slug },
    select: { category_id: true },
  });
  if (found) return { id: found.category_id, created: false };
  try {
    const created = await db.category.create({
      data: {
        slug: seed.slug,
        name: seed.name,
        parent_id: parentId,
        position,
        featured: seed.featured ?? false,
      },
      select: { category_id: true },
    });
    return { id: created.category_id, created: true };
  } catch (error) {
    // Dois processos criando a taxonomia ao mesmo tempo: quem perdeu a corrida só lê o que já existe.
    const again = await db.category.findUnique({
      where: { slug: seed.slug },
      select: { category_id: true },
    });
    if (again) return { id: again.category_id, created: false };
    throw error;
  }
}

/**
 * Cria as categorias da taxonomia que ainda não existem (pelo endereço) e liga a cada raiz os
 * atributos sugeridos (opcionais). Idempotente e sem sobrescrever o que o lojista editou. Devolve
 * `endereço -> category_id` e quantas foram criadas agora. Os atributos precisam existir
 * (ensureAttributeCatalog).
 */
export async function ensureCategoryCatalog(
  db: Db
): Promise<{ ids: Map<string, string>; created: number }> {
  const ids = new Map<string, string>();
  let created = 0;
  const attributes = await db.attribute.findMany({ select: { attribute_id: true, code: true } });
  const attributeId = new Map(
    attributes.map((attribute) => [attribute.code, attribute.attribute_id])
  );

  for (const [position, root] of CATEGORY_CATALOG.entries()) {
    const rootCategory = await ensureCategory(db, root, null, position);
    ids.set(root.slug, rootCategory.id);
    if (rootCategory.created) created += 1;
    for (const [childPosition, child] of (root.children ?? []).entries()) {
      const childCategory = await ensureCategory(db, child, rootCategory.id, childPosition);
      ids.set(child.slug, childCategory.id);
      if (childCategory.created) created += 1;
    }
    // createMany + skipDuplicates (e não upsert): execuções simultâneas não brigam pela mesma linha.
    const links = (root.attributes ?? []).flatMap((code, position) => {
      const id = attributeId.get(code);
      return id
        ? [{ category_id: rootCategory.id, attribute_id: id, is_required: false, position }]
        : [];
    });
    if (links.length > 0)
      await db.categoryAttribute.createMany({ data: links, skipDuplicates: true });
  }
  return { ids, created };
}
