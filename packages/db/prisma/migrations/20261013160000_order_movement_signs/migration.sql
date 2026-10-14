-- O fluxo de pedido gravava `release` e a saída da expedição com quantidade positiva, mas a quantidade
-- do livro-razão é o delta com sinal (como na saída manual e na mesclagem). Corrige os movimentos já
-- gravados e refaz o saldo corrido dos pares afetados.
CREATE TEMP TABLE affected_pairs AS
SELECT DISTINCT sku_id, location_id
FROM "stock_movement"
WHERE quantity > 0
  AND (type = 'release' OR (type = 'outbound' AND reference_type = 'order'));

UPDATE "stock_movement"
SET quantity = -quantity
WHERE quantity > 0
  AND (type = 'release' OR (type = 'outbound' AND reference_type = 'order'));

-- Pares com movimento sem saldo registrado também entram na conta.
INSERT INTO affected_pairs
SELECT DISTINCT sku_id, location_id FROM "stock_movement" WHERE on_hand_after IS NULL
ON CONFLICT DO NOTHING;

WITH running AS (
  SELECT
    m.stock_movement_id,
    SUM(CASE WHEN m.type IN ('reservation', 'release') THEN 0 ELSE m.quantity END) OVER w AS on_hand_after,
    SUM(CASE WHEN m.type IN ('reservation', 'release') THEN m.quantity ELSE 0 END) OVER w AS reserved_after
  FROM "stock_movement" m
  JOIN (SELECT DISTINCT sku_id, location_id FROM affected_pairs) p
    ON p.sku_id = m.sku_id AND p.location_id = m.location_id
  WINDOW w AS (
    PARTITION BY m.sku_id, m.location_id
    ORDER BY m.created_at, m.stock_movement_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )
)
UPDATE "stock_movement" m
SET on_hand_after = r.on_hand_after, reserved_after = r.reserved_after
FROM running r
WHERE m.stock_movement_id = r.stock_movement_id;

DROP TABLE affected_pairs;
