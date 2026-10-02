import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { type ErpRow, erpRowSchema } from './erp-row';

export type InvalidRow = { index: number; codigo: unknown; problem: string };
export type ErpSource = { rows: ErpRow[]; invalid: InvalidRow[]; sha256: string; total: number };

/** Lê o export JSON do ERP e valida cada linha; linha inválida é registrada, nunca derruba a carga. */
export function readErpSource(path: string): ErpSource {
  const buffer = readFileSync(path);
  const parsed: unknown = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(parsed))
    throw new Error('O arquivo do ERP deve ser uma lista (array) de produtos.');

  const results = parsed.map((raw, index) => ({ index, raw, result: erpRowSchema.safeParse(raw) }));
  return {
    total: parsed.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    rows: results.flatMap(({ result }) => (result.success ? [result.data] : [])),
    invalid: results.flatMap(({ index, raw, result }) =>
      result.success
        ? []
        : [
            {
              index,
              codigo: (raw as { codigo?: unknown })?.codigo,
              problem: result.error.issues[0]?.message ?? 'inválida',
            },
          ]
    ),
  };
}
