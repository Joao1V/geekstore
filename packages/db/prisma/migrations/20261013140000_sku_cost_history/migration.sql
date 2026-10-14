-- Histórico de custo por SKU, custo com encargos e linha do tempo da nota de entrada.
CREATE TYPE "PurchaseReceiptEventType" AS ENUM ('posted', 'reverted');

ALTER TABLE "sku" ADD COLUMN "landed_cost_cents" INTEGER;

CREATE TABLE "purchase_receipt_event" (
  "purchase_receipt_event_id" UUID NOT NULL,
  "purchase_receipt_id" UUID NOT NULL,
  "type" "PurchaseReceiptEventType" NOT NULL,
  "reason" VARCHAR(500),
  "user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_receipt_event_pkey" PRIMARY KEY ("purchase_receipt_event_id"),
  CONSTRAINT "purchase_receipt_event_receipt_fkey" FOREIGN KEY ("purchase_receipt_id")
    REFERENCES "purchase_receipt" ("purchase_receipt_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "purchase_receipt_event_purchase_receipt_id_created_at_idx"
  ON "purchase_receipt_event" ("purchase_receipt_id", "created_at");

CREATE TABLE "sku_cost_entry" (
  "sku_cost_entry_id" UUID NOT NULL,
  "sku_id" UUID NOT NULL,
  "purchase_receipt_item_id" UUID NOT NULL,
  "occurred_on" DATE NOT NULL,
  "quantity_in" INTEGER NOT NULL,
  "quantity_before" INTEGER NOT NULL,
  "unit_cost_e4" INTEGER NOT NULL,
  "landed_unit_cost_e4" INTEGER NOT NULL,
  "average_cost_before_e4" INTEGER,
  "average_landed_cost_before_e4" INTEGER,
  "average_cost_after_e4" INTEGER NOT NULL,
  "average_landed_cost_after_e4" INTEGER NOT NULL,
  "reverted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sku_cost_entry_pkey" PRIMARY KEY ("sku_cost_entry_id"),
  CONSTRAINT "sku_cost_entry_sku_fkey" FOREIGN KEY ("sku_id")
    REFERENCES "sku" ("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sku_cost_entry_item_fkey" FOREIGN KEY ("purchase_receipt_item_id")
    REFERENCES "purchase_receipt_item" ("purchase_receipt_item_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sku_cost_entry_purchase_receipt_item_id_key" ON "sku_cost_entry" ("purchase_receipt_item_id");
CREATE INDEX "sku_cost_entry_sku_id_created_at_idx" ON "sku_cost_entry" ("sku_id", "created_at");
