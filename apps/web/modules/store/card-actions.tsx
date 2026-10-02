'use client';

import type { StoreProductCard } from '@geekstore/shared';
import { Button } from '@heroui/react';
import { ArrowRight, Heart, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

import { useCartStore } from './state/cart-store';

const CARD_BUY =
  'mt-[15px] flex h-[42px] w-full items-center justify-center gap-2 rounded-[9px] bg-ink text-sm font-extrabold text-white hover:bg-geek-yellow hover:text-ink dark:bg-geek-yellow dark:text-ink max-md:h-[39px] max-md:gap-[5px] max-md:text-xs';

/** Coração de favoritar (o estado vive no store, então precisa ser client). */
export function FavoriteButton({ productId, name }: { productId: string; name: string }) {
  const favorites = useCartStore((state) => state.favorites);
  const favorite = useCartStore((state) => state.favorite);
  const isFavorite = favorites.includes(productId);
  return (
    <Button
      isIconOnly
      className={`absolute top-[11px] right-[11px] size-[33px] min-w-[33px] rounded-full p-0 text-ink max-md:top-[7px] max-md:right-[7px] max-md:size-[27px] max-md:min-w-[27px] max-md:[&_svg]:w-[15px] ${isFavorite ? 'bg-geek-yellow [&_svg]:fill-ink' : 'bg-white'}`}
      aria-label={`${isFavorite ? 'Remover dos' : 'Adicionar aos'} favoritos: ${name}`}
      aria-pressed={isFavorite}
      onPress={() => favorite(productId)}
    >
      <Heart size={18} />
    </Button>
  );
}

/** Botão do rodapé do cartão: adicionar (1 SKU), escolher opções (variações) ou esgotado. */
export function CardBuy({ product }: { product: StoreProductCard }) {
  const add = useCartStore((state) => state.add);

  if (!product.in_stock) {
    return (
      <button type="button" className={`${CARD_BUY} cursor-not-allowed opacity-50`} disabled>
        Esgotado
      </button>
    );
  }
  if (product.sku_id === null) {
    return (
      <Link className={CARD_BUY} href={`/produto/${product.slug}/`}>
        Escolher opções <ArrowRight size={17} />
      </Link>
    );
  }
  const skuId = product.sku_id;
  return (
    <Button
      className={CARD_BUY}
      onPress={() =>
        add({
          sku_id: skuId,
          slug: product.slug,
          name: product.name,
          variant: '',
          image_url: product.image_url,
          price_cents: product.price_cents,
          max: product.available,
        })
      }
    >
      <ShoppingBag size={17} /> Adicionar
    </Button>
  );
}
