import {
  type ProductBody,
  type ProductDetail,
  type ProductUpdateBody,
  productStatusSchema,
  type SkuBody,
  type SkuUpdateBody,
  skuStatusSchema,
  toCents,
} from '@geekstore/shared';
import { z } from 'zod';

import { emptyToNull } from '../lib/format';

// Opção "nenhum" de um atributo opcional (o Select não aceita valor vazio).
export const NO_VALUE = '__none';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const dimension = z
  .number()
  .int('Use um número inteiro')
  .positive('Deve ser maior que zero')
  .nullable();

const skuFormSchema = z.object({
  // null = SKU novo; o `code` de um SKU existente é imutável.
  sku_id: z.string().nullable(),
  code: z.string().trim().min(1, 'Informe o código do SKU').max(64, 'No máximo 64 caracteres'),
  ean: z.string().regex(/^(\d{8,14})?$/, 'EAN/GTIN com 8 a 14 dígitos'),
  ncm: z.string().regex(/^(\d{8})?$/, 'NCM com 8 dígitos'),
  weight_g: dimension,
  length_mm: dimension,
  width_mm: dimension,
  height_mm: dimension,
  cost: z.number().min(0, 'Não pode ser negativo').nullable(),
  status: skuStatusSchema,
  // código do atributo -> código do valor ({ cor: 'preto' }); vazio = sem valor.
  attributes: z.record(z.string(), z.string()),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome').max(255),
    slug: z.string().regex(SLUG_PATTERN, 'Use minúsculas, números e hífens'),
    category_id: z.string().min(1, 'Escolha a categoria'),
    status: productStatusSchema,
    brand: z.string().max(120, 'No máximo 120 caracteres'),
    description: z.string().max(20000),
    seo_title: z.string().max(255, 'No máximo 255 caracteres'),
    seo_description: z.string().max(500, 'No máximo 500 caracteres'),
    canonical_url: z
      .string()
      .max(500)
      .refine((value) => !value || URL.canParse(value), 'URL inválida'),
    skus: z.array(skuFormSchema).min(1, 'Cadastre ao menos um SKU'),
  })
  .superRefine((product, ctx) => {
    const codes = product.skus.map((sku) => sku.code.trim());
    product.skus.forEach((sku, index) => {
      if (codes.indexOf(sku.code.trim()) !== index) {
        ctx.addIssue({
          code: 'custom',
          path: ['skus', index, 'code'],
          message: 'Código repetido neste produto',
        });
      }
    });
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type SkuFormValues = ProductFormValues['skus'][number];

export function emptySku(): SkuFormValues {
  return {
    sku_id: null,
    code: '',
    ean: '',
    ncm: '',
    weight_g: null,
    length_mm: null,
    width_mm: null,
    height_mm: null,
    cost: null,
    status: 'active',
    attributes: {},
  };
}

export function productFormDefaults(product?: ProductDetail): ProductFormValues {
  if (!product) {
    return {
      name: '',
      slug: '',
      category_id: '',
      status: 'draft',
      brand: '',
      description: '',
      seo_title: '',
      seo_description: '',
      canonical_url: '',
      skus: [emptySku()],
    };
  }
  return {
    name: product.name,
    slug: product.slug,
    category_id: product.category_id,
    status: product.status,
    brand: product.brand ?? '',
    description: product.description ?? '',
    seo_title: product.seo_title ?? '',
    seo_description: product.seo_description ?? '',
    canonical_url: product.canonical_url ?? '',
    skus: product.skus.map((sku) => ({
      sku_id: sku.sku_id,
      code: sku.code,
      ean: sku.ean ?? '',
      ncm: sku.ncm ?? '',
      weight_g: sku.weight_g,
      length_mm: sku.length_mm,
      width_mm: sku.width_mm,
      height_mm: sku.height_mm,
      cost: sku.cost_cents === null ? null : sku.cost_cents / 100,
      status: sku.status,
      attributes: sku.attributes,
    })),
  };
}

function toSkuUpdateBody(sku: SkuFormValues): SkuUpdateBody {
  return {
    ean: emptyToNull(sku.ean),
    ncm: emptyToNull(sku.ncm),
    attributes: Object.fromEntries(
      Object.entries(sku.attributes).filter(([, value]) => value && value !== NO_VALUE)
    ),
    weight_g: sku.weight_g,
    length_mm: sku.length_mm,
    width_mm: sku.width_mm,
    height_mm: sku.height_mm,
    cost_cents: sku.cost === null ? null : toCents(sku.cost),
    status: sku.status,
  };
}

function toSkuBody(sku: SkuFormValues): SkuBody {
  const update = toSkuUpdateBody(sku);
  return {
    code: sku.code.trim(),
    ean: update.ean ?? null,
    ncm: update.ncm ?? null,
    attributes: update.attributes ?? {},
    weight_g: update.weight_g ?? null,
    length_mm: update.length_mm ?? null,
    width_mm: update.width_mm ?? null,
    height_mm: update.height_mm ?? null,
    cost_cents: update.cost_cents ?? null,
    status: update.status ?? 'active',
  };
}

export function toProductUpdateBody(values: ProductFormValues): ProductUpdateBody {
  return {
    category_id: values.category_id,
    name: values.name.trim(),
    slug: values.slug,
    description: emptyToNull(values.description),
    brand: emptyToNull(values.brand),
    status: values.status,
    seo_title: emptyToNull(values.seo_title),
    seo_description: emptyToNull(values.seo_description),
    canonical_url: emptyToNull(values.canonical_url),
  };
}

export function toProductBody(values: ProductFormValues): ProductBody {
  const base = toProductUpdateBody(values);
  return {
    category_id: values.category_id,
    name: values.name.trim(),
    slug: values.slug,
    description: base.description ?? null,
    brand: base.brand ?? null,
    status: values.status,
    seo_title: base.seo_title ?? null,
    seo_description: base.seo_description ?? null,
    canonical_url: base.canonical_url ?? null,
    skus: values.skus.map(toSkuBody),
  };
}

/** Separa os SKUs do formulário em existentes (PATCH) e novos (POST). */
export function splitSkus(values: ProductFormValues) {
  const updatedSkus: { sku_id: string; body: SkuUpdateBody }[] = [];
  const newSkus: SkuBody[] = [];
  for (const sku of values.skus) {
    if (sku.sku_id) updatedSkus.push({ sku_id: sku.sku_id, body: toSkuUpdateBody(sku) });
    else newSkus.push(toSkuBody(sku));
  }
  return { updatedSkus, newSkus };
}
