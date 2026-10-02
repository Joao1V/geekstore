-- AlterTable
ALTER TABLE "sku" DROP COLUMN "attributes";

-- CreateTable
CREATE TABLE "attribute" (
    "attribute_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_pkey" PRIMARY KEY ("attribute_id")
);

-- CreateTable
CREATE TABLE "attribute_value" (
    "attribute_value_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "color_hex" VARCHAR(7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_value_pkey" PRIMARY KEY ("attribute_value_id")
);

-- CreateTable
CREATE TABLE "category_attribute" (
    "category_attribute_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_attribute_pkey" PRIMARY KEY ("category_attribute_id")
);

-- CreateTable
CREATE TABLE "sku_attribute_value" (
    "sku_attribute_value_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "attribute_value_id" UUID NOT NULL,

    CONSTRAINT "sku_attribute_value_pkey" PRIMARY KEY ("sku_attribute_value_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_code_key" ON "attribute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_value_attribute_id_code_key" ON "attribute_value"("attribute_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "category_attribute_category_id_attribute_id_key" ON "category_attribute"("category_id", "attribute_id");

-- CreateIndex
CREATE INDEX "sku_attribute_value_attribute_value_id_idx" ON "sku_attribute_value"("attribute_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "sku_attribute_value_sku_id_attribute_id_key" ON "sku_attribute_value"("sku_id", "attribute_id");

-- AddForeignKey
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute"("attribute_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attribute" ADD CONSTRAINT "category_attribute_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute"("attribute_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_attribute_value" ADD CONSTRAINT "sku_attribute_value_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_attribute_value" ADD CONSTRAINT "sku_attribute_value_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attribute"("attribute_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_attribute_value" ADD CONSTRAINT "sku_attribute_value_attribute_value_id_fkey" FOREIGN KEY ("attribute_value_id") REFERENCES "attribute_value"("attribute_value_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Atributos-base (todo ambiente nasce com eles; os valores novos entram pelo admin ou pela importação).
INSERT INTO "attribute" ("attribute_id", "code", "name", "position", "updated_at") VALUES
  (uuidv7(), 'cor', 'Cor', 0, CURRENT_TIMESTAMP),
  (uuidv7(), 'tamanho', 'Tamanho', 1, CURRENT_TIMESTAMP),
  (uuidv7(), 'numeracao', 'Numeração', 2, CURRENT_TIMESTAMP);

INSERT INTO "attribute_value" ("attribute_value_id", "attribute_id", "code", "label", "position", "color_hex", "updated_at")
SELECT uuidv7(), a."attribute_id", v.code, v.label, v.position, v.hex, CURRENT_TIMESTAMP
FROM "attribute" a
JOIN (VALUES
  ('cor', 'preto', 'Preto', 0, '#111111'),
  ('cor', 'branco', 'Branco', 1, '#FFFFFF'),
  ('cor', 'off-white', 'Off White', 2, '#F2EFE6'),
  ('cor', 'cinza', 'Cinza', 3, '#8A8F98'),
  ('cor', 'azul', 'Azul', 4, '#1F5FBF'),
  ('cor', 'azul-marinho', 'Azul Marinho', 5, '#14213D'),
  ('cor', 'verde', 'Verde', 6, '#2E8B57'),
  ('cor', 'amarelo', 'Amarelo', 7, '#F5C400'),
  ('cor', 'laranja', 'Laranja', 8, '#F28C28'),
  ('cor', 'vermelho', 'Vermelho', 9, '#D62828'),
  ('cor', 'vinho', 'Vinho', 10, '#6D1A36'),
  ('cor', 'rosa', 'Rosa', 11, '#F28CB1'),
  ('cor', 'roxo', 'Roxo', 12, '#6A2C91'),
  ('cor', 'marrom', 'Marrom', 13, '#6B4226'),
  ('tamanho', 'pp', 'PP', 0, NULL),
  ('tamanho', 'p', 'P', 1, NULL),
  ('tamanho', 'm', 'M', 2, NULL),
  ('tamanho', 'g', 'G', 3, NULL),
  ('tamanho', 'gg', 'GG', 4, NULL),
  ('tamanho', 'xg', 'XG', 5, NULL),
  ('tamanho', 'xgg', 'XGG', 6, NULL)
) AS v(attr, code, label, position, hex) ON v.attr = a."code";
