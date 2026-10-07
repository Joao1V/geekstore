import { readFileSync } from 'node:fs';
import { prisma } from '@geekstore/db';
import { z } from 'zod';

const BATCH = 2_000;

const legacyMapSchema = z.array(
  z.object({ sku_code: z.string(), erp_code: z.string().min(1).max(32), erp_name: z.string() })
);
export type LegacyLink = z.infer<typeof legacyMapSchema>[number];

export const readLegacyMap = (path: string): LegacyLink[] =>
  legacyMapSchema.parse(JSON.parse(readFileSync(path, 'utf8')));

/**
 * Grava em cada SKU o código do item no ERP (`legacy_code`) e o nome que ele tinha lá (`legacy_data`),
 * a partir do mapa legado. É o elo entre a base antiga e a nova: só o admin vê, a loja nunca mostra.
 * Reexecutar é seguro (mesmo SKU, mesmo código); código do ERP já usado por outro SKU o UNIQUE recusa.
 */
export async function linkLegacy(
  links: readonly LegacyLink[]
): Promise<{ linked: number; missing: number }> {
  let linked = 0;
  for (let start = 0; start < links.length; start += BATCH) {
    const batch = links.slice(start, start + BATCH);
    linked += await prisma.$executeRaw`
      UPDATE sku SET
        legacy_code = v.erp_code,
        legacy_data = COALESCE(sku.legacy_data, '{}'::jsonb) || jsonb_build_object('erp_name', v.erp_name)
      FROM unnest(${batch.map((l) => l.sku_code)}::text[], ${batch.map((l) => l.erp_code)}::text[], ${batch.map((l) => l.erp_name)}::text[])
        AS v(sku_code, erp_code, erp_name)
      WHERE sku.code = v.sku_code`;
  }
  return { linked, missing: links.length - linked };
}
