-- Estornos de pagamento (RF-PAG-06).
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'succeeded', 'failed');

CREATE TABLE "refund" (
    "refund_id" UUID NOT NULL DEFAULT uuidv7(),
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "reason" VARCHAR(255) NOT NULL,
    "external_id" VARCHAR(100),
    "error" VARCHAR(500),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "refund_pkey" PRIMARY KEY ("refund_id"),
    CONSTRAINT "refund_amount_positive" CHECK ("amount_cents" > 0)
);

CREATE INDEX "refund_order_id_idx" ON "refund"("order_id");
CREATE INDEX "refund_payment_id_idx" ON "refund"("payment_id");

ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refund" ADD CONSTRAINT "refund_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
