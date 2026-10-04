import type { ShippingQuote, ZipLookup } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api';

type QuoteLine = { sku_id: string; quantity: number };

/** Opções de frete do carrinho para o CEP (o servidor calcula com preço e peso do banco). */
export const shippingQuoteQuery = (zip: string, items: readonly QuoteLine[]) =>
  queryOptions({
    queryKey: ['store', 'shipping-quote', zip, items],
    queryFn: () => api.post<ShippingQuote>('/api/store/shipping/quote', { zip, items }),
    staleTime: 60_000,
    retry: false,
  });

/** Endereço do CEP; falha (CEP inexistente ou serviço fora) vira erro para a tela deixar preencher à mão. */
export const lookupZip = (zip: string) => api.get<ZipLookup>(`/api/store/shipping/zip/${zip}`);

import type { Order } from '@geekstore/shared';

/** Pedido pelo identificador (quem comprou sem conta guarda o link). */
export const orderByIdQuery = (orderId: string) =>
  queryOptions({
    queryKey: ['store', 'order', orderId],
    queryFn: () => api.get<Order>(`/api/store/orders/${orderId}`),
  });

import type { CartCheckLine } from '@geekstore/shared';

/** Confere os itens do carrinho no servidor (à venda? preço? quantos há?). */
export const checkCart = (items: readonly { sku_id: string; quantity: number }[]) =>
  api.post<CartCheckLine[]>('/api/store/cart/check', { items });
