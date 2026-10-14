-- Recuperação de senha do cliente (RF-CLI-02).
CREATE TABLE "password_reset" (
    "password_reset_id" UUID NOT NULL DEFAULT uuidv7(),
    "customer_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_pkey" PRIMARY KEY ("password_reset_id")
);

CREATE INDEX "password_reset_customer_id_created_at_idx" ON "password_reset"("customer_id", "created_at");

ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;
