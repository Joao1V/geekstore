-- Banners da home da loja. Os dois que já existiam no código entram como linhas, para a loja seguir igual.
CREATE TABLE "banner" (
    "banner_id" UUID NOT NULL DEFAULT uuidv7(),
    "tag" VARCHAR(120),
    "headline" VARCHAR(160) NOT NULL,
    "text" VARCHAR(300),
    "cta_label" VARCHAR(60) NOT NULL,
    "href" VARCHAR(300) NOT NULL,
    "image_url" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banner_pkey" PRIMARY KEY ("banner_id")
);

CREATE INDEX "banner_position_idx" ON "banner"("position");

INSERT INTO "banner" ("tag", "headline", "text", "cta_label", "href", "position", "updated_at") VALUES
  ('O próximo capítulo é seu', E'Seu universo.\nSua coleção.',
   'Colecionáveis, games e itens que contam a sua história.',
   'Encontrar meu próximo drop', '/catalogo/', 1, CURRENT_TIMESTAMP),
  ('Dê um upgrade na coleção', E'Pequenos achados.\nGrandes histórias.',
   'Explore os produtos e encontre seu próximo favorito.',
   'Ver as novidades', '/catalogo/?ordem=newest', 2, CURRENT_TIMESTAMP);
