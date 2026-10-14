-- Encargos da nota (frete, seguro, outras despesas, desconto, IPI, ICMS-ST) e fator de conversão do item.
CREATE TYPE "ApportionBasis" AS ENUM ('value', 'quantity');

ALTER TABLE "purchase_receipt"
  ADD COLUMN "freight_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "insurance_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "other_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ipi_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "icms_st_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "include_ipi" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "include_icms_st" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "apportion_basis" "ApportionBasis" NOT NULL DEFAULT 'value';

ALTER TABLE "purchase_receipt_item"
  ADD COLUMN "xml_quantity" INTEGER,
  ADD COLUMN "unit_factor" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "discount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ipi_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "icms_st_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "landed_unit_cost_e4" INTEGER;

-- Notas antigas: o fator é 1, então a quantidade da nota é a que já estava gravada.
UPDATE "purchase_receipt_item" SET "xml_quantity" = "quantity";
ALTER TABLE "purchase_receipt_item" ALTER COLUMN "xml_quantity" SET NOT NULL;
ALTER TABLE "purchase_receipt_item"
  ADD CONSTRAINT "purchase_receipt_item_unit_factor_positive" CHECK ("unit_factor" >= 1);

ALTER TABLE "supplier_sku" ADD COLUMN "unit_factor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "supplier_sku"
  ADD CONSTRAINT "supplier_sku_unit_factor_positive" CHECK ("unit_factor" >= 1);
