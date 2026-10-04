// Chaves de query da conta do cliente, centralizadas para as invalidações casarem com as queries.
export const customerKeys = {
  addresses: ['customer', 'addresses'] as const,
  orders: ['customer', 'orders'] as const,
  order: (number: number) => ['customer', 'orders', number] as const,
};
