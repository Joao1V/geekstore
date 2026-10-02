import type { PrismaClient } from '../generated/client/index.js';
import { ATTRIBUTE_CATALOG, valueCodeOf } from './attribute-catalog';

// Aceita o cliente e o cliente de transação.
type Db = Pick<PrismaClient, 'attribute' | 'attributeValue'>;

async function ensureAttribute(db: Db, code: string, name: string, position: number) {
  const found = await db.attribute.findUnique({ where: { code }, select: { attribute_id: true } });
  if (found) return found.attribute_id;
  try {
    const created = await db.attribute.create({
      data: { code, name, position },
      select: { attribute_id: true },
    });
    return created.attribute_id;
  } catch (error) {
    // Dois processos criando o catálogo ao mesmo tempo: quem perdeu a corrida só lê o que já existe.
    const again = await db.attribute.findUnique({
      where: { code },
      select: { attribute_id: true },
    });
    if (again) return again.attribute_id;
    throw error;
  }
}

/**
 * Cria os atributos e valores do catálogo que ainda não existem. Idempotente, seguro com
 * execuções simultâneas e sem sobrescrever: o que o lojista editou (rótulo, sufixo, ordem, cor)
 * permanece.
 */
export async function ensureAttributeCatalog(db: Db): Promise<void> {
  for (const [position, attribute] of ATTRIBUTE_CATALOG.entries()) {
    const attributeId = await ensureAttribute(db, attribute.code, attribute.name, position);
    await db.attributeValue.createMany({
      data: attribute.values.map((value, valuePosition) => ({
        attribute_id: attributeId,
        code: valueCodeOf(value.label),
        label: value.label,
        sku_suffix: value.suffix,
        position: valuePosition,
        color_hex: value.hex ?? null,
      })),
      skipDuplicates: true,
    });
  }
}
