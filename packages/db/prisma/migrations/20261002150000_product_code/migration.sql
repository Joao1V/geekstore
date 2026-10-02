-- Código do produto: base dos SKUs das variações. Produtos existentes (se houver) recebem um código
-- provisório a partir do id; os novos informam o próprio.
ALTER TABLE "product" ADD COLUMN "code" VARCHAR(40);
UPDATE "product" SET "code" = 'P-' || upper(left(replace("product_id"::text, '-', ''), 12)) WHERE "code" IS NULL;
ALTER TABLE "product" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "product_code_key" ON "product"("code");
