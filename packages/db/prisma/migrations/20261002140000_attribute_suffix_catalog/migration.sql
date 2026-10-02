-- Os atributos passam a vir do catálogo em código (ensureAttributeCatalog), com sufixo de SKU por
-- valor. As sementes das migrações anteriores (sem sufixo) saem, desde que ainda não haja SKU ligado
-- a elas: nunca se apaga dado de catálogo de verdade.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "sku_attribute_value") THEN
    RAISE EXCEPTION 'Há SKUs com atributos: migre os valores antes de aplicar esta migração.';
  END IF;
END $$;

DELETE FROM "category_attribute";
DELETE FROM "attribute_value";
DELETE FROM "attribute";

-- AlterTable
ALTER TABLE "attribute" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "attribute_value" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sku_suffix" VARCHAR(12) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "attribute_value_attribute_id_sku_suffix_key" ON "attribute_value"("attribute_id", "sku_suffix");

