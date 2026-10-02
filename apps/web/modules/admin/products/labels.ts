export const PRODUCT_STATUS_LABELS = {
  draft: 'Rascunho',
  active: 'Ativo',
  archived: 'Arquivado',
} as const;

/** Nome de cada pendência do catálogo (filtro `issue` da lista e cartões do painel). */
export const ISSUE_LABELS = {
  no_photo: 'Sem foto',
  out_of_stock: 'Sem estoque',
  no_price: 'Sem preço',
  no_brand: 'Sem marca',
  no_description: 'Sem descrição',
  no_weight: 'Sem peso (frete)',
} as const;

export const PRODUCT_STATUS_TONES = {
  draft: 'warning',
  active: 'success',
  archived: 'neutral',
} as const;

export const PRODUCT_STATUS_OPTIONS = Object.entries(PRODUCT_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const SKU_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];
