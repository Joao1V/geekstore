import type { StoreProductCard } from '@geekstore/shared';
import { Truck } from 'lucide-react';
import Link from 'next/link';

import { Price, ScarcityBadge } from '@/components/ui';
import { FavoriteButton } from './card-actions';
import {
  discountPercent,
  FREE_SHIPPING_MIN_CENTS,
  formatBRL,
  installmentPlan,
  pixCents,
} from './lib/money';
import { ProductImage } from './product-image';

/**
 * Cartão de produto (servidor), no estilo dos grandes marketplaces: o cartão INTEIRO leva à página do
 * produto (é lá que se escolhe a opção e se compra); só o coração é um botão à parte.
 */
export function ProductCard({
  product: p,
  priority = false,
}: {
  product: StoreProductCard;
  priority?: boolean;
}) {
  const onSale = p.compare_at_cents !== null && p.compare_at_cents > p.price_cents;
  const hasVariants = p.price_max_cents > p.price_cents;
  const plan = installmentPlan(p.price_cents);
  const label = p.brand ?? p.category_name;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[14px] border-2 border-ink bg-surface transition-[translate,box-shadow] duration-200 [box-shadow:4px_4px_0_var(--ink-shadow)] hover:-translate-y-0.5 hover:[box-shadow:6px_7px_0_var(--ink-shadow)] max-md:[box-shadow:3px_3px_var(--ink-shadow)]">
      <div className="relative aspect-square overflow-hidden bg-white">
        <ProductImage
          src={p.image_url}
          alt=""
          fit="contain"
          priority={priority}
          className={`transition-transform duration-300 group-hover:scale-[1.03] ${p.in_stock ? '' : 'opacity-50 grayscale'}`}
        />
        {!p.in_stock && (
          <span className="absolute top-3 left-3 rounded-md bg-ink px-2 py-1 text-2xs font-black text-white max-md:top-2 max-md:left-2">
            Esgotado
          </span>
        )}
        {p.in_stock && (
          <span className="absolute bottom-3 left-3 max-md:bottom-2 max-md:left-2">
            <ScarcityBadge available={p.available} compact />
          </span>
        )}
        <FavoriteButton productId={p.product_id} name={p.name} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 border-t border-border px-4 pt-3.5 pb-4 max-md:px-3 max-md:pt-3 max-md:pb-3.5">
        <p
          className="truncate text-2xs font-extrabold tracking-[0.08em] text-muted uppercase"
          title={label}
        >
          {label}
        </p>
        <h3 className="line-clamp-2 min-h-[2.7em] text-[15px] leading-[1.35] font-extrabold max-md:text-sm">
          {/* O ::after estica o link por cima do cartão inteiro; o coração (z-10) fica acima dele. */}
          <Link
            href={`/produto/${p.slug}/`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {p.name}
          </Link>
        </h3>
        <div className="mt-1 grid gap-0.5">
          {onSale && <del className="text-xs text-muted">{formatBRL(p.compare_at_cents ?? 0)}</del>}
          <div className="flex flex-wrap items-baseline gap-x-2">
            {hasVariants && <span className="text-xs text-muted">a partir de</span>}
            <Price size="sm" value={p.price_cents / 100} />
            {onSale && (
              <span className="text-sm font-extrabold text-status-success">
                {discountPercent(p.price_cents, p.compare_at_cents ?? p.price_cents)}% OFF
              </span>
            )}
          </div>
        </div>
        {plan ? (
          <p className="text-sm leading-snug font-extrabold text-status-success">
            em {plan.count}x {formatBRL(plan.valueCents)}{' '}
            <span className="font-black">sem juros</span>
          </p>
        ) : (
          <p className="text-sm text-muted">à vista</p>
        )}
        <p className="text-xs text-muted">
          ou <strong className="text-foreground">{formatBRL(pixCents(p.price_cents))}</strong> no
          Pix
        </p>
        {p.price_cents >= FREE_SHIPPING_MIN_CENTS && (
          <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-extrabold text-status-success">
            <Truck size={14} aria-hidden="true" /> Frete grátis*
          </p>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: StoreProductCard[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(235px,1fr))] gap-7 max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-5">
      {items.map((product, index) => (
        <ProductCard key={product.product_id} product={product} priority={index < 4} />
      ))}
    </div>
  );
}
