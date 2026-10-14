-- Uma nota desprocessada pode ser lançada de novo: o item passa a ter várias entradas de custo ao
-- longo do tempo (as revertidas ficam no histórico).
DROP INDEX "sku_cost_entry_purchase_receipt_item_id_key";
CREATE INDEX "sku_cost_entry_purchase_receipt_item_id_idx" ON "sku_cost_entry" ("purchase_receipt_item_id");
