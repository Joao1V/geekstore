-- Marca quando um refresh token foi trocado por outro, para dar uma janela curta à corrida entre abas
-- sem tratar token revogado por logout ou por reuso como se tivesse sido apenas trocado.
ALTER TABLE "refresh_token" ADD COLUMN "rotated_at" TIMESTAMP(3);
ALTER TABLE "customer_refresh_token" ADD COLUMN "rotated_at" TIMESTAMP(3);
