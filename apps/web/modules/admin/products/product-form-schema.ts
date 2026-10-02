import {
  axesFromSkus,
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

const CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
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
  manufacturer_code: z.string().max(60, 'No máximo 60 caracteres'),
  weight_g: dimension,
  length_mm: dimension,
  width_mm: dimension,
  height_mm: dimension,
  cost: z.number().min(0, 'Não pode ser negativo').nullable(),
  status: skuStatusSchema,
  // Só no SKU novo: preço de venda (R$) e saldo de entrada. Nos existentes, a grade de estoque cuida.
  price: z.number().positive('Maior que zero').nullable(),
  initial_stock: z.number().int('Número inteiro').min(0, 'Não pode ser negativo').nullable(),
  // código do atributo -> código do valor ({ cor: 'preto' }); vazio = sem valor.
  attributes: z.record(z.string(), z.string()),
});

export const productFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, 'Informe o código')
      .max(40, 'No máximo 40 caracteres')
      .regex(CODE_PATTERN, 'Letras, números e hífen (ex.: CAM-NARUTO)'),
    name: z.string().trim().min(1, 'Informe o nome').max(255),
    slug: z.string().regex(SLUG_PATTERN, 'Use minúsculas, números e hífens'),
    category_id: z.string().min(1, 'Escolha a categoria'),
    status: productStatusSchema,
    // brand_id da marca escolhida; vazio = sem marca.
    brand_id: z.string().nullable(),
    description: z.string().max(20000),
    seo_title: z.string().max(255, 'No máximo 255 caracteres'),
    seo_description: z.string().max(500, 'No máximo 500 caracteres'),
    canonical_url: z
      .string()
      .max(500)
      .refine((value) => !value || URL.canParse(value), 'URL inválida'),
    skus: z.array(skuFormSchema).min(1, 'Cadastre ao menos um SKU'),
    // Grade: o que o lojista escolheu (cor: preto e branco; tamanho: P, M, G). Gera as linhas de `skus`.
    has_grid: z.boolean(),
    axes: z.array(z.object({ attribute: z.string(), values: z.array(z.string()) })),
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
    manufacturer_code: '',
    weight_g: null,
    length_mm: null,
    width_mm: null,
    height_mm: null,
    cost: null,
    status: 'active',
    attributes: {},
    price: null,
    initial_stock: null,
  };
}

export function productFormDefaults(product?: ProductDetail): ProductFormValues {
  if (!product) {
    return {
      code: '',
      has_grid: false,
      axes: [],
      name: '',
      slug: '',
      category_id: '',
      status: 'draft',
      brand_id: null,
      description: '',
      seo_title: '',
      seo_description: '',
      canonical_url: '',
      skus: [emptySku()],
    };
  }
  return {
    code: product.code,
    has_grid:
      product.skus.length > 1 || product.skus.some((sku) => Object.keys(sku.attributes).length > 0),
    axes: axesFromSkus(product.skus),
    name: product.name,
    slug: product.slug,
    category_id: product.category_id,
    status: product.status,
    brand_id: product.brand_id,
    description: product.description ?? '',
    seo_title: product.seo_title ?? '',
    seo_description: product.seo_description ?? '',
    canonical_url: product.canonical_url ?? '',
    skus: product.skus.map((sku) => ({
      sku_id: sku.sku_id,
      code: sku.code,
      ean: sku.ean ?? '',
      ncm: sku.ncm ?? '',
      manufacturer_code: sku.manufacturer_code ?? '',
      weight_g: sku.weight_g,
      length_mm: sku.length_mm,
      width_mm: sku.width_mm,
      height_mm: sku.height_mm,
      cost: sku.cost_cents === null ? null : sku.cost_cents / 100,
      status: sku.status,
      attributes: sku.attributes,
      price: null,
      initial_stock: null,
    })),
  };
}

function toSkuUpdateBody(sku: SkuFormValues): SkuUpdateBody {
  return {
    ean: emptyToNull(sku.ean),
    ncm: emptyToNull(sku.ncm),
    manufacturer_code: emptyToNull(sku.manufacturer_code),
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
    manufacturer_code: update.manufacturer_code ?? null,
    attributes: update.attributes ?? {},
    price_cents: sku.price === null ? null : toCents(sku.price),
    initial_stock: sku.initial_stock,
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
    brand_id: values.brand_id || null,
    status: values.status,
    seo_title: emptyToNull(values.seo_title),
    seo_description: emptyToNull(values.seo_description),
    canonical_url: emptyToNull(values.canonical_url),
  };
}

export function toProductBody(values: ProductFormValues): ProductBody {
  const base = toProductUpdateBody(values);
  return {
    code: values.code.trim().toUpperCase(),
    category_id: values.category_id,
    name: values.name.trim(),
    slug: values.slug,
    description: base.description ?? null,
    brand_id: base.brand_id ?? null,
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
