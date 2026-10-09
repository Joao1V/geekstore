-- Páginas institucionais da loja (RF-VIT-07). Corpo em Markdown; só `published` aparece na loja.
CREATE TYPE "PageStatus" AS ENUM ('draft', 'published');

CREATE TABLE "page" (
    "page_id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" "PageStatus" NOT NULL DEFAULT 'draft',
    "seo_title" VARCHAR(255),
    "seo_description" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_pkey" PRIMARY KEY ("page_id")
);

CREATE UNIQUE INDEX "page_slug_key" ON "page"("slug");

-- As quatro páginas que o SPEC pede nascem como RASCUNHO, só com o roteiro dos títulos: a política
-- de trocas, os dados da empresa e o atendimento são conteúdo da loja e não se inventam aqui.
INSERT INTO "page" ("slug", "title", "body", "status", "position", "updated_at") VALUES
  ('trocas-e-devolucoes', 'Trocas e devoluções',
   E'## Prazo\n\nEscreva aqui em quantos dias o cliente pode pedir troca ou devolução.\n\n## Condições\n\nEscreva aqui o estado em que o produto precisa estar.\n\n## Como pedir\n\nEscreva aqui o passo a passo e o canal de atendimento.',
   'draft', 1, CURRENT_TIMESTAMP),
  ('nos-conheca', 'Nos conheça',
   E'## Quem somos\n\nEscreva aqui a história da loja.\n\n## Onde estamos\n\nEscreva aqui o endereço da loja física, se houver.',
   'draft', 2, CURRENT_TIMESTAMP),
  ('contato', 'Contato',
   E'## Fale com a gente\n\nEscreva aqui e-mail, WhatsApp e horário de atendimento.',
   'draft', 3, CURRENT_TIMESTAMP),
  ('manual-do-comprador', 'Manual do comprador',
   E'## Como comprar\n\nEscreva aqui o passo a passo da compra.\n\n## Formas de pagamento\n\nEscreva aqui as formas de pagamento aceitas.\n\n## Entrega\n\nEscreva aqui prazos e regiões atendidas.',
   'draft', 4, CURRENT_TIMESTAMP);
