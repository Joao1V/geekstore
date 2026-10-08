import type { ProductDetail } from '@geekstore/shared';
import type { ReactNode } from 'react';

import { formatDateTime } from '../lib/format';
import { Badge } from '../ui/badge';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_TONES } from './labels';
import { ProductGallery } from './product-gallery';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="muted">{label}</dt>
      <dd className="m-0 text-right font-bold break-words">{children}</dd>
    </div>
  );
}

function BrandValue({ product }: { product: ProductDetail }) {
  if (!product.brand) return '—';
  if (!product.brand_logo_url) return product.brand;
  return (
    // biome-ignore lint/performance/noImgElement: URL do bucket, sem otimização do Next
    <img
      src={product.brand_logo_url}
      alt={product.brand}
      title={product.brand}
      className="ml-auto h-7 max-w-28 object-contain"
    />
  );
}

/** Card lateral do produto: galeria, nome e fatos rápidos. */
export function ProductSummaryCard({ product }: { product: ProductDetail }) {
  return (
    <section aria-label="Resumo do produto" className="surface grid gap-4 p-5">
      <ProductGallery product={product} />
      <h2 className="m-0 text-lg leading-snug font-extrabold">{product.name}</h2>
      <dl className="m-0 grid gap-2.5 border-t border-border pt-4">
        <Fact label="Situação">
          <Badge tone={PRODUCT_STATUS_TONES[product.status]}>
            {PRODUCT_STATUS_LABELS[product.status]}
          </Badge>
        </Fact>
        <Fact label="Código">{product.code}</Fact>
        <Fact label="Marca">
          <BrandValue product={product} />
        </Fact>
        <Fact label="SKUs">{product.skus.length}</Fact>
        <Fact label="Fotos">{product.media.length}</Fact>
        <Fact label="Atualizado">{formatDateTime(product.updated_at)}</Fact>
      </dl>
    </section>
  );
}
