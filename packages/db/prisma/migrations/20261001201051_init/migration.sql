-- Fuso do banco em UTC: o Prisma grava DateTime como `timestamp` sem fuso (sempre UTC) e os
-- defaults/`now()` convertem pelo fuso da sessão. Com o banco em UTC os dois concordam.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO ''UTC''', current_database());
END
$$;

-- Busca sem acento (ex.: "acessorios" acha "Acessórios"). `unaccent` é extensão confiável (PG 13+).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "SkuStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "CollectionKind" AS ENUM ('franchise', 'curated');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('warehouse', 'store', 'quarantine');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('inbound', 'outbound', 'adjustment', 'reservation', 'release', 'return');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('active', 'committed', 'consumed', 'released', 'expired');

-- CreateTable
CREATE TABLE "user" (
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "refresh_token_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("refresh_token_id")
);

-- CreateTable
CREATE TABLE "role" (
    "role_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "audit_log_id" UUID NOT NULL,
    "user_id" UUID,
    "entity" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("audit_log_id")
);

-- CreateTable
CREATE TABLE "category" (
    "category_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(255),
    "seo_description" VARCHAR(500),
    "canonical_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "product" (
    "product_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "brand" VARCHAR(120),
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "seo_title" VARCHAR(255),
    "seo_description" VARCHAR(500),
    "canonical_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "sku" (
    "sku_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "ean" VARCHAR(14),
    "attributes" JSONB NOT NULL,
    "weight_g" INTEGER,
    "length_mm" INTEGER,
    "width_mm" INTEGER,
    "height_mm" INTEGER,
    "ncm" VARCHAR(8),
    "cost_cents" INTEGER,
    "status" "SkuStatus" NOT NULL DEFAULT 'active',
    "legacy_code" VARCHAR(32),
    "legacy_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_pkey" PRIMARY KEY ("sku_id")
);

-- CreateTable
CREATE TABLE "collection" (
    "collection_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "kind" "CollectionKind" NOT NULL DEFAULT 'franchise',
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("collection_id")
);

-- CreateTable
CREATE TABLE "collection_product" (
    "collection_product_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_product_pkey" PRIMARY KEY ("collection_product_id")
);

-- CreateTable
CREATE TABLE "media" (
    "media_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku_id" UUID,
    "url" VARCHAR(500) NOT NULL,
    "alt" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("media_id")
);

-- CreateTable
CREATE TABLE "location" (
    "location_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'warehouse',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "stock_level" (
    "stock_level_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_level_pkey" PRIMARY KEY ("stock_level_id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "stock_movement_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" VARCHAR(255),
    "reference_type" VARCHAR(32),
    "reference_id" UUID,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("stock_movement_id")
);

-- CreateTable
CREATE TABLE "stock_reservation" (
    "stock_reservation_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "checkout_id" UUID,
    "order_id" UUID,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservation_pkey" PRIMARY KEY ("stock_reservation_id")
);

-- CreateTable
CREATE TABLE "channel" (
    "channel_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "credentials_encrypted" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_pkey" PRIMARY KEY ("channel_id")
);

-- CreateTable
CREATE TABLE "price" (
    "price_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "compare_at_cents" INTEGER,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_pkey" PRIMARY KEY ("price_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_id_idx" ON "user"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_parent_id_idx" ON "category"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE INDEX "product_category_id_idx" ON "product"("category_id");

-- CreateIndex
CREATE INDEX "product_status_idx" ON "product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sku_code_key" ON "sku"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sku_legacy_code_key" ON "sku"("legacy_code");

-- CreateIndex
CREATE INDEX "sku_product_id_idx" ON "sku"("product_id");

-- CreateIndex
CREATE INDEX "sku_ean_idx" ON "sku"("ean");

-- CreateIndex
CREATE UNIQUE INDEX "collection_slug_key" ON "collection"("slug");

-- CreateIndex
CREATE INDEX "collection_product_product_id_idx" ON "collection_product"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_product_collection_id_product_id_key" ON "collection_product"("collection_id", "product_id");

-- CreateIndex
CREATE INDEX "media_product_id_position_idx" ON "media"("product_id", "position");

-- CreateIndex
CREATE INDEX "media_sku_id_idx" ON "media"("sku_id");

-- CreateIndex
CREATE INDEX "stock_level_location_id_idx" ON "stock_level"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_level_sku_id_location_id_key" ON "stock_level"("sku_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_movement_sku_id_location_id_created_at_idx" ON "stock_movement"("sku_id", "location_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movement_reference_type_reference_id_idx" ON "stock_movement"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservation_idempotency_key_key" ON "stock_reservation"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_reservation_sku_id_location_id_idx" ON "stock_reservation"("sku_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_reservation_status_expires_at_idx" ON "stock_reservation"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "channel_code_key" ON "channel"("code");

-- CreateIndex
CREATE INDEX "price_channel_id_idx" ON "price"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_sku_id_channel_id_starts_at_key" ON "price"("sku_id", "channel_id", "starts_at");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku" ADD CONSTRAINT "sku_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("collection_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_level" ADD CONSTRAINT "stock_level_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_level" ADD CONSTRAINT "stock_level_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price" ADD CONSTRAINT "price_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price" ADD CONSTRAINT "price_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel"("channel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridade do estoque (RNF-09): saldo nunca negativo e reservado nunca acima do físico.
ALTER TABLE "stock_level" ADD CONSTRAINT "stock_level_non_negative_chk"
    CHECK ("on_hand" >= 0 AND "reserved" >= 0 AND "reserved" <= "on_hand");

-- Perfis do admin (RF-PLA-03). O mapa perfil -> permissões vive em `packages/shared/src/rbac.ts`.
INSERT INTO "role" ("role_id", "code", "name") VALUES
    (uuidv7(), 'owner', 'Dono'),
    (uuidv7(), 'manager', 'Gerente'),
    (uuidv7(), 'stock', 'Estoque'),
    (uuidv7(), 'support', 'Atendimento'),
    (uuidv7(), 'viewer', 'Leitura');

-- Canais de venda e local padrão da operação.
INSERT INTO "channel" ("channel_id", "code", "name") VALUES
    (uuidv7(), 'site', 'Site'),
    (uuidv7(), 'ml', 'Mercado Livre'),
    (uuidv7(), 'shopee', 'Shopee');
INSERT INTO "location" ("location_id", "name", "type") VALUES
    (uuidv7(), 'Depósito', 'warehouse');
