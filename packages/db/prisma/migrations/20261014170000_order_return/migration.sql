-- Devolução de itens enviados, com recebimento e avaliação (RF-PED-04).
CREATE TYPE "ReturnStatus" AS ENUM ('requested', 'received');

CREATE TABLE "order_return" (
    "order_return_id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'requested',
    "reason" VARCHAR(255) NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3),

    CONSTRAINT "order_return_pkey" PRIMARY KEY ("order_return_id")
);

CREATE TABLE "order_return_item" (
    "order_return_item_id" UUID NOT NULL DEFAULT uuidv7(),
    "order_return_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "resellable_quantity" INTEGER,
    "damaged_quantity" INTEGER,

    CONSTRAINT "order_return_item_pkey" PRIMARY KEY ("order_return_item_id"),
    CONSTRAINT "order_return_item_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "order_return_item_split_matches" CHECK (
      ("resellable_quantity" IS NULL AND "damaged_quantity" IS NULL)
      OR ("resellable_quantity" >= 0 AND "damaged_quantity" >= 0
          AND "resellable_quantity" + "damaged_quantity" = "quantity")
    )
);

CREATE INDEX "order_return_order_id_idx" ON "order_return"("order_id");
CREATE UNIQUE INDEX "order_return_item_order_return_id_sku_id_key" ON "order_return_item"("order_return_id", "sku_id");

ALTER TABLE "order_return" ADD CONSTRAINT "order_return_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_return" ADD CONSTRAINT "order_return_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_return_item" ADD CONSTRAINT "order_return_item_order_return_id_fkey" FOREIGN KEY ("order_return_id") REFERENCES "order_return"("order_return_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_return_item" ADD CONSTRAINT "order_return_item_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;
