-- Entrar com Google: o `sub` da conta Google identifica quem já vinculou o login.
ALTER TABLE "user" ADD COLUMN "google_sub" VARCHAR(64);
ALTER TABLE "customer" ADD COLUMN "google_sub" VARCHAR(64);

CREATE UNIQUE INDEX "user_google_sub_key" ON "user"("google_sub");
CREATE UNIQUE INDEX "customer_google_sub_key" ON "customer"("google_sub");
