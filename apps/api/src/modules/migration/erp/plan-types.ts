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
  | 'slug_collision';

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

export type PlannedItem = {
  legacyCode: string;
  skuCode: string;
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
  /** Slugs de categoria já em uso no banco. */
  takenCategorySlugs?: ReadonlySet<string>;
};
