-- CreateTable
CREATE TABLE "sku_sequence" (
    "prefix" VARCHAR(8) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_sequence_pkey" PRIMARY KEY ("prefix")
);
