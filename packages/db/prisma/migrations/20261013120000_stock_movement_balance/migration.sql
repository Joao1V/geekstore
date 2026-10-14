-- Saldo do par SKU/local depois de cada movimento + custo unitário da entrada.
ALTER TABLE "stock_movement"
  ADD COLUMN "on_hand_after" INTEGER,
  ADD COLUMN "reserved_after" INTEGER,
  ADD COLUMN "unit_cost_e4" INTEGER;

-- Preenche o histórico: saldo corrido por par SKU/local, na ordem do livro-razão (UUID v7 é
-- cronológico). `quantity` mexe em `reserved` nas reservas/liberações e em `on_hand` no resto.
WITH running AS (
  SELECT
    stock_movement_id,
    SUM(CASE WHEN type IN ('reservation', 'release') THEN 0 ELSE quantity END)
      OVER w AS on_hand_after,
    SUM(CASE WHEN type = 'reservation' THEN quantity WHEN type = 'release' THEN -quantity ELSE 0 END)
      OVER w AS reserved_after
  FROM "stock_movement"
  WINDOW w AS (
    PARTITION BY sku_id, location_id
    ORDER BY created_at, stock_movement_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )
)
UPDATE "stock_movement" m
SET on_hand_after = r.on_hand_after, reserved_after = r.reserved_after
FROM running r
WHERE m.stock_movement_id = r.stock_movement_id;

-- Par cujo histórico não fecha com o saldo atual (carga antiga sem movimento): deixa NULL em vez de
-- gravar um saldo que o livro-razão não sustenta.
UPDATE "stock_movement" m
SET on_hand_after = NULL, reserved_after = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM "stock_level" l
  WHERE l.sku_id = m.sku_id AND l.location_id = m.location_id
    AND l.on_hand = (
      SELECT x.on_hand_after FROM "stock_movement" x
      WHERE x.sku_id = m.sku_id AND x.location_id = m.location_id
      ORDER BY x.created_at DESC, x.stock_movement_id DESC LIMIT 1
    )
    AND l.reserved = (
      SELECT x.reserved_after FROM "stock_movement" x
      WHERE x.sku_id = m.sku_id AND x.location_id = m.location_id
      ORDER BY x.created_at DESC, x.stock_movement_id DESC LIMIT 1
    )
);
