-- Nomes das chaves estrangeiras no padrão que o Prisma espera (evita deriva no `migrate diff`).
ALTER TABLE "purchase_receipt_event"
  RENAME CONSTRAINT "purchase_receipt_event_receipt_fkey" TO "purchase_receipt_event_purchase_receipt_id_fkey";
ALTER TABLE "sku_cost_entry"
  RENAME CONSTRAINT "sku_cost_entry_sku_fkey" TO "sku_cost_entry_sku_id_fkey";
ALTER TABLE "sku_cost_entry"
  RENAME CONSTRAINT "sku_cost_entry_item_fkey" TO "sku_cost_entry_purchase_receipt_item_id_fkey";
