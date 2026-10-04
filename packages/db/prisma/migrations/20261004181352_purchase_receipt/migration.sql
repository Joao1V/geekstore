-- CreateEnum
CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('draft', 'posted');

-- CreateEnum
CREATE TYPE "ReceiptMatchMethod" AS ENUM ('mapping', 'ean', 'manual');

-- CreateTable
CREATE TABLE "supplier" (
    "supplier_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "document" VARCHAR(14),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "purchase_receipt" (
    "purchase_receipt_id" UUID NOT NULL,
    "supplier_id" UUID,
    "number" VARCHAR(20),
    "series" VARCHAR(5),
    "access_key" VARCHAR(44),
    "issued_at" TIMESTAMP(3),
    "total_cents" INTEGER NOT NULL,
    "location_id" UUID NOT NULL,
    "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "xml" TEXT,
    "posted_at" TIMESTAMP(3),
    "posted_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_receipt_pkey" PRIMARY KEY ("purchase_receipt_id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_item" (
    "purchase_receipt_item_id" UUID NOT NULL,
    "purchase_receipt_id" UUID NOT NULL,
    "line" INTEGER NOT NULL,
    "supplier_code" VARCHAR(60),
    "description" VARCHAR(500) NOT NULL,
    "ean" VARCHAR(14),
    "ncm" VARCHAR(8),
    "quantity" INTEGER NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "total_cost_cents" INTEGER NOT NULL,
    "sku_id" UUID,
    "match_method" "ReceiptMatchMethod",
    "ignored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "purchase_receipt_item_pkey" PRIMARY KEY ("purchase_receipt_item_id")
);

-- CreateTable
CREATE TABLE "supplier_sku" (
    "supplier_sku_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_code" VARCHAR(60) NOT NULL,
    "sku_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_sku_pkey" PRIMARY KEY ("supplier_sku_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_document_key" ON "supplier"("document");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_access_key_key" ON "purchase_receipt"("access_key");

-- CreateIndex
CREATE INDEX "purchase_receipt_supplier_id_idx" ON "purchase_receipt"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_receipt_status_created_at_idx" ON "purchase_receipt"("status", "created_at");

-- CreateIndex
CREATE INDEX "purchase_receipt_item_sku_id_idx" ON "purchase_receipt_item"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_item_purchase_receipt_id_line_key" ON "purchase_receipt_item"("purchase_receipt_id", "line");

-- CreateIndex
CREATE INDEX "supplier_sku_sku_id_idx" ON "supplier_sku"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_sku_supplier_id_supplier_code_key" ON "supplier_sku"("supplier_id", "supplier_code");

-- AddForeignKey
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("supplier_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_item" ADD CONSTRAINT "purchase_receipt_item_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipt"("purchase_receipt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_item" ADD CONSTRAINT "purchase_receipt_item_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_sku" ADD CONSTRAINT "supplier_sku_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("supplier_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_sku" ADD CONSTRAINT "supplier_sku_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE CASCADE ON UPDATE CASCADE;
