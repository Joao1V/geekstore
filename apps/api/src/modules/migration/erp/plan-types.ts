import type { MeasureIssue } from './measures';

export type IssueCode =
  | MeasureIssue
  | 'ean_invalid'
  | 'ean_duplicate'
  | 'ncm_invalid'
  | 'stock_negative'
  | 'stock_missing'
  | 'no_photo'
  | 'photo_not_https'
  | 'promo_expired'
  | 'promo_invalid'
  | 'promo_perpetual'
  | 'slug_collision'
  | 'variant_ambiguous';

/** Pendência de um item: não impede a importação, vai para o relatório. */
export type Issue = { legacyCode: string; code: IssueCode; detail: string };

export type SkipReason = 'group_excluded' | 'no_price';
export type Skipped = { legacyCode: string; name: string; reason: SkipReason; detail: string };

export type Promo = {
  priceCents: number;
  compareAtCents: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Uma linha do ERP = um SKU. Os campos de produto (nome, slug, fotos...) se repetem nos SKUs do mesmo `productKey`. */
export type PlannedItem = {
  legacyCode: string;
  skuCode: string;
  /** SKUs com a mesma chave viram um produto só (variações de cor e tamanho). */
  productKey: string;
  /** Ex.: `{ cor: 'Preto', tamanho: 'GG' }`; vazio em produto simples. */
  attributes: Record<string, string>;
  /** Nome do item no ERP (já normalizado), para o relatório. */
  erpName: string;
  name: string;
  slug: string;
  description: string | null;
  categoryKey: string;
  productStatus: 'active' | 'draft';
  skuStatus: 'active' | 'inactive';
  ean: string | null;
  ncm: string | null;
  weightG: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  priceCents: number;
  promo: Promo | null;
  stock: number;
  photos: string[];
  legacyData: Record<string, unknown>;
};

export type PlannedCategory = {
  key: string;
  parentKey: string | null;
  name: string;
  slug: string;
  position: number;
  productCount: number;
};

export type CatalogPlan = {
  categories: PlannedCategory[];
  items: PlannedItem[];
  skipped: Skipped[];
  issues: Issue[];
  duplicateEans: { ean: string; legacyCodes: string[] }[];
};

export type PlanOptions = {
  now: Date;
  /** Slugs de produto já em uso no banco (reexecução); o plano nunca os repete. */
  takenSlugs?: ReadonlySet<string>;
  /** Códigos de SKU já em uso no banco; o plano nunca os repete. */
  takenSkuCodes?: ReadonlySet<string>;
  /** Slugs de categoria já em uso no banco. */
  takenCategorySlugs?: ReadonlySet<string>;
};
