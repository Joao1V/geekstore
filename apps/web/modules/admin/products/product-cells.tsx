import { formatBRL, type ProductListItem } from '@geekstore/shared';

import type { CategoryLabel } from '../lib/category-tree';
import { formatInteger } from '../lib/format';
import { Badge } from '../ui/badge';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from './labels';

const CODE_CHIP = 'rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs font-bold';

/** SKU: o código principal. Em produto com variações mostra o primeiro e quantos mais existem. */
export function SkuCell({ product }: { product: ProductListItem }) {
  const [first] = product.sku_codes;
  const more = product.sku_count - 1;
  return (
    <div className="grid justify-items-start gap-1">
      <code className={CODE_CHIP}>{first ?? '—'}</code>
      {more > 0 && (
        <span className="muted text-2xs">
          +{more} {more === 1 ? 'variação' : 'variações'}
        </span>
      )}
    </div>
  );
}

/** Código do ERP de origem (para a integração e a conferência com o sistema antigo). */
export function LegacyCodeCell({ product }: { product: ProductListItem }) {
  const [first] = product.legacy_codes;
  if (!first) return <span className="muted text-xs">—</span>;
  const more = product.sku_count - 1;
  return (
    <div className="grid justify-items-start gap-1">
      <code className="font-mono text-xs text-muted">{first}</code>
      {more > 0 && <span className="muted text-2xs">+{more}</span>}
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

/** Ponto colorido + número: vermelho só quando esgotou (o texto garante a leitura sem cor). */
export function StockCell({ available }: { available: number }) {
  const isOut = available <= 0;
  return (
    <span className="inline-flex items-center gap-2 font-bold tabular-nums">
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${isOut ? 'bg-status-error' : 'bg-status-success'}`}
      />
      {isOut ? 'Esgotado' : formatInteger(available)}
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
