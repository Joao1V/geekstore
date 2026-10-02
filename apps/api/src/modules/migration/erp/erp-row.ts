import { z } from 'zod';

// Aceita texto ou número: o export do ERP não é consistente entre linhas.
const looseText = z
  .union([z.string(), z.number()])
  .nullable()
  .default(null)
  .transform((value) => (value === null ? null : String(value).trim() || null));

const nullableNumber = z.number().nullable().default(null);

/** Uma linha do export do ERP (`geek_store_produtos.json`). Cada linha já é um SKU. */
export const erpRowSchema = z.object({
  codigo: z.number().int().positive(),
  nome: z.string().trim().min(1),
  descricao_detalhada: z.string().nullable().default(null),
  codigo_barras: looseText,
  codigo_fabricante: looseText,
  grupo: z.string().trim().min(1),
  subgrupo: z.string().nullable().default(null),
  preco_venda: nullableNumber,
  preco_promocao: nullableNumber,
  promocao_inicio: z.string().nullable().default(null),
  promocao_fim: z.string().nullable().default(null),
  estoque: nullableNumber,
  unidade: z.string().nullable().default(null),
  peso_bruto_kg: nullableNumber,
  peso_liquido_kg: nullableNumber,
  altura: nullableNumber,
  largura: nullableNumber,
  comprimento: nullableNumber,
  ncm: looseText,
  ultima_alteracao: z.string().nullable().default(null),
  fotos: z.array(z.string()).default([]),
});
export type ErpRow = z.infer<typeof erpRowSchema>;
