import type { Location, StockLevel, StockMovement } from '@geekstore/shared';

type LevelRow = Omit<StockLevel, 'available'>;
type MovementRow = Omit<StockMovement, 'created_at'> & { created_at: Date };

export function toLocation(row: Location): Location {
  return { location_id: row.location_id, name: row.name, type: row.type };
}

export function toStockLevel(row: LevelRow): StockLevel {
  return {
    stock_level_id: row.stock_level_id,
    sku_id: row.sku_id,
    location_id: row.location_id,
    on_hand: row.on_hand,
    reserved: row.reserved,
    available: row.on_hand - row.reserved,
  };
}

export function toStockMovement(row: MovementRow): StockMovement {
  return {
    stock_movement_id: row.stock_movement_id,
    sku_id: row.sku_id,
    location_id: row.location_id,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    user_id: row.user_id,
    created_at: row.created_at.toISOString(),
  };
}
