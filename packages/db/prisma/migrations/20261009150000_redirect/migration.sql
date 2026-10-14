-- Redirecionamentos 301 da loja antiga para a nova (RF-MIG-03).
CREATE TABLE "redirect" (
    "redirect_id" UUID NOT NULL DEFAULT uuidv7(),
    "from_path" VARCHAR(600) NOT NULL,
    "to_path" VARCHAR(600) NOT NULL,
    "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
    "note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirect_pkey" PRIMARY KEY ("redirect_id")
);

CREATE UNIQUE INDEX "redirect_from_path_key" ON "redirect"("from_path");
CREATE INDEX "redirect_source_idx" ON "redirect"("source");
