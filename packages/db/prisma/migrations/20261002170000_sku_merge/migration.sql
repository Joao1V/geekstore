-- AlterTable
ALTER TABLE "sku" ADD COLUMN     "merged_into_sku_id" UUID;

-- CreateTable
CREATE TABLE "duplicate_dismissal" (
    "duplicate_dismissal_id" UUID NOT NULL,
    "group_key" VARCHAR(64) NOT NULL,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_dismissal_pkey" PRIMARY KEY ("duplicate_dismissal_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_dismissal_group_key_key" ON "duplicate_dismissal"("group_key");

-- CreateIndex
CREATE INDEX "sku_merged_into_sku_id_idx" ON "sku"("merged_into_sku_id");

-- AddForeignKey
ALTER TABLE "sku" ADD CONSTRAINT "sku_merged_into_sku_id_fkey" FOREIGN KEY ("merged_into_sku_id") REFERENCES "sku"("sku_id") ON DELETE SET NULL ON UPDATE CASCADE;

