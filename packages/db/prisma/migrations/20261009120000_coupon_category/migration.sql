-- Cupom restrito a categorias (RF-PRE-04). Sem linhas, o cupom vale para o carrinho todo.
CREATE TABLE "coupon_category" (
    "coupon_category_id" UUID NOT NULL DEFAULT uuidv7(),
    "coupon_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_category_pkey" PRIMARY KEY ("coupon_category_id")
);

CREATE UNIQUE INDEX "coupon_category_coupon_id_category_id_key" ON "coupon_category"("coupon_id", "category_id");
CREATE INDEX "coupon_category_category_id_idx" ON "coupon_category"("category_id");

ALTER TABLE "coupon_category" ADD CONSTRAINT "coupon_category_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupon"("coupon_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_category" ADD CONSTRAINT "coupon_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;
