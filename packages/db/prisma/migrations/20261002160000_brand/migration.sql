-- Marca vira tabela. Qualquer marca já digitada em `product.brand` é preservada: vira uma linha de
-- `brand` e o produto passa a apontar para ela antes de a coluna antiga sair.
CREATE TABLE "brand" (
    "brand_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brand_pkey" PRIMARY KEY ("brand_id")
);
CREATE UNIQUE INDEX "brand_name_key" ON "brand"("name");
CREATE UNIQUE INDEX "brand_slug_key" ON "brand"("slug");

-- Uma marca por endereço (slug): "Funko", "FUNKO" e "funko " viram a mesma marca.
INSERT INTO "brand" ("brand_id", "name", "slug", "updated_at")
SELECT uuidv7(), picked.name, picked.slug, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (slug) slug, name
  FROM (
    SELECT trim("brand") AS name,
           trim(both '-' from lower(regexp_replace(unaccent(trim("brand")), '[^a-zA-Z0-9]+', '-', 'g'))) AS slug
    FROM "product"
    WHERE trim(coalesce("brand", '')) <> ''
  ) named
  WHERE slug <> ''
  ORDER BY slug, name
) picked;

ALTER TABLE "product" ADD COLUMN "brand_id" UUID;
UPDATE "product" p SET "brand_id" = b."brand_id"
FROM "brand" b
WHERE trim(coalesce(p."brand", '')) <> ''
  AND b."slug" = trim(both '-' from lower(regexp_replace(unaccent(trim(p."brand")), '[^a-zA-Z0-9]+', '-', 'g')));
ALTER TABLE "product" DROP COLUMN "brand";

ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand"("brand_id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "product_brand_id_idx" ON "product"("brand_id");

ALTER TABLE "sku" ADD COLUMN "manufacturer_code" VARCHAR(60);
