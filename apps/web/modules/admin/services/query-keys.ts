// Chaves de query do admin, centralizadas para as invalidações das mutations casarem com as queries.

export const adminKeys = {
  categories: ['admin', 'categories'] as const,
  collections: ['admin', 'collections'] as const,
  collectionProducts: (collectionId: string) =>
    ['admin', 'collections', 'products', collectionId] as const,
  products: ['admin', 'products'] as const,
  productList: (params: object) => ['admin', 'products', 'list', params] as const,
  productSummary: ['admin', 'products', 'summary'] as const,
  productDetail: (productId: string) => ['admin', 'products', 'detail', productId] as const,
  skuGrid: ['admin', 'sku-grid'] as const,
  skuGridList: (params: object) => ['admin', 'sku-grid', 'list', params] as const,
  locations: ['admin', 'stock', 'locations'] as const,
  stockLevels: ['admin', 'stock', 'levels'] as const,
  movements: ['admin', 'stock', 'movements'] as const,
  movementList: (params: object) => ['admin', 'stock', 'movements', 'list', params] as const,
  prices: (skuId: string) => ['admin', 'pricing', 'prices', skuId] as const,
  auditLogs: (params: object) => ['admin', 'audit-logs', params] as const,
  users: ['admin', 'users'] as const,
  userList: (params: object) => ['admin', 'users', 'list', params] as const,
};
