'use client';

import { Button } from '@heroui/react';
import { Heart } from 'lucide-react';

import { useCartStore } from './state/cart-store';

/** Coração de favoritar (o estado vive no store, então precisa ser client). Fica acima do link do card. */
export function FavoriteButton({ productId, name }: { productId: string; name: string }) {
  const favorites = useCartStore((state) => state.favorites);
  const favorite = useCartStore((state) => state.favorite);
  const isFavorite = favorites.includes(productId);
  return (
    <Button
      isIconOnly
      className={`absolute top-3 right-3 z-10 size-[34px] min-w-[34px] rounded-full p-0 text-ink shadow-[0_2px_8px_#0002] max-md:top-2 max-md:right-2 max-md:size-[30px] max-md:min-w-[30px] ${isFavorite ? 'bg-geek-yellow [&_svg]:fill-ink' : 'bg-white'}`}
      aria-label={`${isFavorite ? 'Remover dos' : 'Adicionar aos'} favoritos: ${name}`}
      aria-pressed={isFavorite}
      onPress={() => favorite(productId)}
    >
      <Heart size={18} />
    </Button>
  );
}
