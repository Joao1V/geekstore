-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('open', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'partially_refunded', 'refunded');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('not_picked', 'picking', 'partially_shipped', 'shipped', 'delivered');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('pix', 'card', 'boleto');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('pending', 'approved', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('pending', 'shipped', 'delivered');

-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('percent', 'amount', 'free_shipping');

-- CreateTable
CREATE TABLE "customer" (
    "customer_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "document" VARCHAR(14),
    "phone" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "customer_refresh_token" (
    "customer_refresh_token_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_refresh_token_pkey" PRIMARY KEY ("customer_refresh_token_id")
);

-- CreateTable
CREATE TABLE "address" (
    "address_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "zip" VARCHAR(8) NOT NULL,
    "street" VARCHAR(255) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "complement" VARCHAR(120),
    "neighborhood" VARCHAR(120) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "order" (
    "order_id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "channel_id" UUID NOT NULL,
    "external_order_id" VARCHAR(64),
    "customer_id" UUID,
    "contact_name" VARCHAR(255) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "contact_phone" VARCHAR(20),
    "contact_document" VARCHAR(14),
    "status" "OrderStatus" NOT NULL DEFAULT 'open',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'not_picked',
    "subtotal_cents" INTEGER NOT NULL,
    "shipping_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "coupon_code" VARCHAR(40),
    "shipping_address" JSONB NOT NULL,
    "shipping_service" VARCHAR(80) NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "cancel_reason" VARCHAR(255),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "order_item_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sku_id" UUID NOT NULL,
    "sku_code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "variant" VARCHAR(255),
    "image_url" VARCHAR(500),
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("order_item_id")
);

-- CreateTable
CREATE TABLE "payment" (
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'pending',
    "amount_cents" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "details" JSONB,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "webhook_event_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "event_id" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100),
    "state" VARCHAR(16) NOT NULL,
    "payload" JSONB NOT NULL,
    "error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("webhook_event_id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "carrier" VARCHAR(60) NOT NULL,
    "service" VARCHAR(80) NOT NULL,
    "tracking_code" VARCHAR(60),
    "status" "ShipmentStatus" NOT NULL DEFAULT 'pending',
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("shipment_id")
);

-- CreateTable
CREATE TABLE "coupon" (
    "coupon_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "kind" "CouponKind" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "min_subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "max_uses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("coupon_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_email_key" ON "customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_refresh_token_token_hash_key" ON "customer_refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "customer_refresh_token_customer_id_idx" ON "customer_refresh_token"("customer_id");

-- CreateIndex
CREATE INDEX "address_customer_id_idx" ON "address"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_number_key" ON "order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "order_idempotency_key_key" ON "order"("idempotency_key");

-- CreateIndex
CREATE INDEX "order_customer_id_created_at_idx" ON "order"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "order_status_created_at_idx" ON "order"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_channel_id_external_order_id_key" ON "order"("channel_id", "external_order_id");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_sku_id_idx" ON "order_item"("sku_id");

-- CreateIndex
CREATE INDEX "payment_order_id_idx" ON "payment"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_external_id_key" ON "payment"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_provider_event_id_key" ON "webhook_event"("provider", "event_id");

-- CreateIndex
CREATE INDEX "shipment_order_id_idx" ON "shipment"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_code_key" ON "coupon"("code");

-- AddForeignKey
ALTER TABLE "customer_refresh_token" ADD CONSTRAINT "customer_refresh_token_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channel"("channel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Números de pedido legíveis: o primeiro é o 1001.
ALTER SEQUENCE "order_number_seq" RESTART WITH 1001;
