-- Newsletter com confirmação (RF-VIT-08) e "avise-me quando chegar" (RF-VIT-09).
CREATE TABLE "newsletter_subscriber" (
    "newsletter_subscriber_id" UUID NOT NULL DEFAULT uuidv7(),
    "email" VARCHAR(255) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscriber_pkey" PRIMARY KEY ("newsletter_subscriber_id")
);

CREATE UNIQUE INDEX "newsletter_subscriber_email_key" ON "newsletter_subscriber"("email");

CREATE TABLE "stock_alert" (
    "stock_alert_id" UUID NOT NULL DEFAULT uuidv7(),
    "sku_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_alert_pkey" PRIMARY KEY ("stock_alert_id")
);

CREATE UNIQUE INDEX "stock_alert_sku_id_email_key" ON "stock_alert"("sku_id", "email");
CREATE INDEX "stock_alert_notified_at_idx" ON "stock_alert"("notified_at");

ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "sku"("sku_id") ON DELETE CASCADE ON UPDATE CASCADE;
