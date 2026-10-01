import { z } from 'zod';

import {
  dataResponse,
  isoDateTimeSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './common';

export const locationTypeSchema = z.enum(['warehouse', 'store', 'quarantine']);

export const locationSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string(),
  type: locationTypeSchema,
});
export type Location = z.infer<typeof locationSchema>;
export const locationListResponseSchema = z.object({ data: z.array(locationSchema) });

/** `available` = on_hand - reserved. Locais de quarentena não entram no vendável. */
export const stockLevelSchema = z.object({
  stock_level_id: z.string().uuid(),
  sku_id: z.string().uuid(),
  location_id: z.string().uuid(),
  on_hand: z.number().int(),
  reserved: z.number().int(),
  available: z.number().int(),
});
export type StockLevel = z.infer<typeof stockLevelSchema>;

export const stockLevelListQuerySchema = paginationQuerySchema.extend({
  sku_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
});
export type StockLevelListQuery = z.infer<typeof stockLevelListQuerySchema>;
export const stockLevelListResponseSchema = paginatedResponse(stockLevelSchema);

export const stockMovementTypeSchema = z.enum([
  'inbound',
  'outbound',
  'adjustment',
  'reservation',
  'release',
  'return',
]);

export const stockMovementSchema = z.object({
  stock_movement_id: z.string().uuid(),
  sku_id: z.string().uuid(),
  location_id: z.string().uuid(),
  type: stockMovementTypeSchema,
  quantity: z.number().int(),
  reason: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  created_at: isoDateTimeSchema,
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

/**
 * Movimentação manual. `inbound`/`return` somam, `outbound` subtrai (a `quantity` do body é sempre
 * positiva); `adjustment` aceita delta com sinal, diferente de zero. Reserva e liberação são da F3.
 */
export const stockMovementBodySchema = z
  .object({
    sku_id: z.string().uuid(),
    location_id: z.string().uuid(),
    type: z.enum(['inbound', 'outbound', 'adjustment', 'return']),
    quantity: z.number().int(),
    reason: z.string().min(1).max(255),
  })
  .refine((body) => body.quantity !== 0, {
    path: ['quantity'],
    message: 'quantidade não pode ser 0',
  })
  .refine((body) => body.type === 'adjustment' || body.quantity > 0, {
    path: ['quantity'],
    message: 'quantidade deve ser positiva',
  });
export type StockMovementBody = z.infer<typeof stockMovementBodySchema>;
export const stockMovementResponseSchema = dataResponse(
  z.object({ movement: stockMovementSchema, level: stockLevelSchema })
);

export const stockMovementListQuerySchema = paginationQuerySchema.extend({
  sku_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
});
export type StockMovementListQuery = z.infer<typeof stockMovementListQuerySchema>;
export const stockMovementListResponseSchema = paginatedResponse(stockMovementSchema);

/** Edição em lote da grade: define o `on_hand` absoluto; cada linha vira uma movimentação de ajuste. */
export const stockBulkBodySchema = z.object({
  reason: z.string().min(1).max(255).default('Ajuste pela grade'),
  items: z
    .array(
      z.object({
        sku_id: z.string().uuid(),
        location_id: z.string().uuid(),
        on_hand: z.number().int().min(0),
      })
    )
    .min(1)
    .max(500),
});
export type StockBulkBody = z.infer<typeof stockBulkBodySchema>;
export const stockBulkResponseSchema = dataResponse(z.object({ updated: z.number().int() }));

/** Conferência entre o saldo do `StockLevel` e a soma das movimentações (RF-EST-10). */
export const stockDivergenceSchema = z.object({
  sku_id: z.string().uuid(),
  location_id: z.string().uuid(),
  level_on_hand: z.number().int(),
  ledger_on_hand: z.number().int(),
  level_reserved: z.number().int(),
  ledger_reserved: z.number().int(),
});
export const stockReconcileResponseSchema = dataResponse(
  z.object({ checked: z.number().int(), divergences: z.array(stockDivergenceSchema) })
);
