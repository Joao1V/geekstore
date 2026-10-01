export const PRODUCT_STATUS_LABELS = {
  draft: 'Rascunho',
  active: 'Ativo',
  archived: 'Arquivado',
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
