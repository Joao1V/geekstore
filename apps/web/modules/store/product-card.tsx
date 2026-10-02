import type { StoreProductCard } from '@geekstore/shared';
import Link from 'next/link';

import { Price } from '@/components/ui';
import { CardBuy, FavoriteButton } from './card-actions';
import {
  discountPercent,
  FREE_SHIPPING_MIN_CENTS,
  formatBRL,
  INSTALLMENTS,
  pixCents,
} from './lib/money';
import { ProductImage } from './product-image';

/** Cartão de produto (servidor): só o coração e o botão de compra são interativos. */
export function ProductCard({
  product: p,
  priority = false,
}: {
  product: StoreProductCard;
  priority?: boolean;
}) {
  const href = `/produto/${p.slug}/`;
  const onSale = p.compare_at_cents !== null && p.compare_at_cents > p.price_cents;
  const hasVariants = p.price_max_cents > p.price_cents;
  const badge = !p.in_stock
    ? 'Esgotado'
    : onSale
      ? `-${discountPercent(p.price_cents, p.compare_at_cents ?? p.price_cents)}%`
      : null;

  return (
    <article className="group overflow-hidden rounded-[17px] border-2 border-ink bg-surface transition-[translate,box-shadow] duration-200 [box-shadow:6px_6px_0_var(--ink-shadow)] hover:-translate-x-0.5 hover:-translate-y-[3px] hover:[box-shadow:8px_9px_0_var(--ink-shadow)] max-md:rounded-[13px] max-md:[box-shadow:4px_4px_var(--ink-shadow)]">
      <div className="relative aspect-square overflow-hidden bg-placeholder">
        <Link className="relative block h-full" href={href} aria-label={`Ver ${p.name}`}>
          <ProductImage
            src={p.image_url}
            alt={p.name}
            priority={priority}
            className={`transition-transform duration-[400ms] group-hover:scale-[1.035] ${p.in_stock ? '' : 'opacity-60 grayscale'}`}
          />
        </Link>
        {badge && (
          <span className="absolute top-3 left-3 rounded-[7px] bg-geek-yellow px-[9px] py-[5px] text-2xs font-black text-ink max-md:top-2 max-md:left-[7px] max-md:px-1.5 max-md:py-1">
            {badge}
          </span>
        )}
        <FavoriteButton productId={p.product_id} name={p.name} />
      </div>
      <div className="px-[17px] pt-5 pb-[17px] max-tablet:px-3 max-tablet:py-[15px] max-md:px-2.5 max-md:py-3.5">
        <p className="eyebrow muted truncate text-2xs max-md:tracking-[0.06em]">
          {p.brand ?? p.category_name}
        </p>
        <Link
          href={href}
          className="mt-[9px] mb-[13px] line-clamp-2 block min-h-12 text-base leading-[1.4] font-extrabold max-md:min-h-[54px] max-md:text-sm"
        >
          {p.name}
        </Link>
        <div className="mb-0.5 h-5 text-xs text-muted">
          {onSale ? (
            <del>{formatBRL(p.compare_at_cents ?? 0)}</del>
          ) : hasVariants ? (
            <span>A partir de</span>
          ) : null}
        </div>
        <Price value={pixCents(p.price_cents) / 100} />
        <p className="pix">
          no Pix <span>5% de desconto*</span>
        </p>
        <p className="mt-2 min-h-9 text-xs text-muted max-md:min-h-[33px] max-md:text-2xs">
          ou {formatBRL(p.price_cents)} em {INSTALLMENTS}x de{' '}
          {formatBRL(Math.round(p.price_cents / INSTALLMENTS))}
        </p>
        {p.price_cents >= FREE_SHIPPING_MIN_CENTS && (
          <small className="mt-1 block text-xs text-status-success max-md:text-2xs">
            Frete grátis neste exemplo*
          </small>
        )}
        <CardBuy product={p} />
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: StoreProductCard[] }) {
  return (
    <div className="grid grid-cols-4 gap-6 max-tablet:gap-[18px] max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-[22px]">
      {items.map((product, index) => (
        <ProductCard key={product.product_id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
