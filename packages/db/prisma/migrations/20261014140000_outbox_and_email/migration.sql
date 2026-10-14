-- Outbox transacional (D12/RF-PLA-07) e e-mails transacionais (RF-COM-01).
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'published', 'failed');
CREATE TYPE "EmailStatus" AS ENUM ('pending', 'sent', 'failed');

CREATE TABLE "outbox_event" (
    "outbox_event_id" UUID NOT NULL DEFAULT uuidv7(),
    "type" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(32) NOT NULL,
    "entity_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("outbox_event_id")
);

CREATE INDEX "outbox_event_status_available_at_idx" ON "outbox_event"("status", "available_at");
CREATE INDEX "outbox_event_entity_type_entity_id_idx" ON "outbox_event"("entity_type", "entity_id");

CREATE TABLE "email_message" (
    "email_message_id" UUID NOT NULL DEFAULT uuidv7(),
    "outbox_event_id" UUID NOT NULL,
    "template" VARCHAR(48) NOT NULL,
    "to_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "provider_id" VARCHAR(100),
    "error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "email_message_pkey" PRIMARY KEY ("email_message_id")
);

CREATE UNIQUE INDEX "email_message_outbox_event_id_template_key" ON "email_message"("outbox_event_id", "template");

ALTER TABLE "email_message" ADD CONSTRAINT "email_message_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_event"("outbox_event_id") ON DELETE RESTRICT ON UPDATE CASCADE;
