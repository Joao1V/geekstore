-- Entrar com Google existe só para o cliente da loja; o painel continua com e-mail e senha.
DROP INDEX "user_google_sub_key";
ALTER TABLE "user" DROP COLUMN "google_sub";
