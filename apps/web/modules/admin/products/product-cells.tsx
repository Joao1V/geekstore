import { formatBRL, type ProductListItem } from '@geekstore/shared';

import type { CategoryLabel } from '../lib/category-tree';
import { formatInteger } from '../lib/format';
import { Badge } from '../ui/badge';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from './labels';

// Abaixo (ou igual) a este saldo o estoque é "baixo": o operador precisa repor.
const LOW_STOCK_LIMIT = 5;

/** Código do produto em fonte monoespaçada (o que se copia e procura) e quantos SKUs ele tem. */
export function SkuCell({ product }: { product: ProductListItem }) {
  return (
    <div className="grid justify-items-start gap-1">
      <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs font-bold">
        {product.code}
      </code>
      <span className="muted text-2xs">
        {product.sku_count} {product.sku_count === 1 ? 'SKU' : 'SKUs'}
        {product.sku_count === 1 && product.sku_codes[0] && product.sku_codes[0] !== product.code
          ? ` · ${product.sku_codes[0]}`
          : ''}
      </span>
    </div>
  );
}

/** "R$ 349,99", ou "R$ 59,90 – R$ 79,90" quando as variações têm preços diferentes. */
export function PriceCell({ product }: { product: ProductListItem }) {
  const { price_min_cents: min, price_max_cents: max } = product;
  if (min === null || max === null) return <span className="muted text-xs">Sem preço</span>;
  if (min === max) return <strong className="tabular-nums">{formatBRL(min)}</strong>;
  return (
    <span className="grid">
      <strong className="tabular-nums">{formatBRL(min)}</strong>
      <span className="muted text-2xs tabular-nums">até {formatBRL(max)}</span>
    </span>
  );
}

/** Ponto colorido + número: o texto garante a leitura para quem não distingue as cores. */
export function StockCell({ available }: { available: number }) {
  const state =
    available <= 0
      ? { dot: 'bg-status-error', text: 'Esgotado' }
      : available <= LOW_STOCK_LIMIT
        ? { dot: 'bg-status-warning', text: `${formatInteger(available)} · baixo` }
        : { dot: 'bg-status-success', text: formatInteger(available) };
  return (
    <span className="inline-flex items-center gap-2 font-bold tabular-nums">
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${state.dot}`} />
      {state.text}
    </span>
  );
}

/** Situação com o PORQUÊ: rascunho sem foto ou sem estoque diz isso, em vez de só "Rascunho". */
export function StatusCell({ product }: { product: ProductListItem }) {
  const reasons =
    product.status === 'draft'
      ? [
          ...(product.thumbnail_url === null ? ['Sem foto'] : []),
          ...(product.available <= 0 ? ['Sem estoque'] : []),
        ]
      : [];
  return (
    <div className="grid justify-items-start gap-1">
      <Badge tone={PRODUCT_STATUS_TONES[product.status]}>
        {PRODUCT_STATUS_LABELS[product.status]}
      </Badge>
      {reasons.length > 0 && <span className="muted text-2xs">{reasons.join(' · ')}</span>}
    </div>
  );
}

export function CategoryCell({ label }: { label: CategoryLabel | undefined }) {
  if (!label) return <span className="muted">—</span>;
  return (
    <span className="grid">
      <span>{label.name}</span>
      {label.parent && <span className="muted text-2xs">{label.parent}</span>}
    </span>
  );
}
