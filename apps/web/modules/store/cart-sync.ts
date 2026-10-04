'use client';

import { useEffect } from 'react';

import { checkCart } from './services/checkout/queries';
import { useCartStore } from './state/cart-store';

/**
 * Enquanto `active`, confere o carrinho no servidor e o acerta: tira o que saiu de venda, ajusta
 * quantidade ao estoque e atualiza o preço. Avisa com um toast quando algo mudou. Falha de rede é
 * ignorada (o carrinho segue como está e o servidor confere de novo na compra).
 */
export function useCartSync(active: boolean) {
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const signature = useCartStore((state) =>
    state.lines.map((line) => `${line.sku_id}:${line.qty}`).join(',')
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` resume as linhas; só confere quando elas mudam.
  useEffect(() => {
    const { lines, reconcile, notify } = useCartStore.getState();
    if (!active || !hasHydrated || lines.length === 0) return;
    let cancelled = false;
    checkCart(lines.map((line) => ({ sku_id: line.sku_id, quantity: line.qty })))
      .then((checks) => {
        if (cancelled) return;
        const { removed, adjusted } = reconcile(checks);
        if (removed > 0) notify('Alguns itens não estão mais à venda e saíram do carrinho.');
        else if (adjusted > 0) notify('Atualizamos preço ou quantidade de itens do seu carrinho.');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active, hasHydrated, signature]);
}
