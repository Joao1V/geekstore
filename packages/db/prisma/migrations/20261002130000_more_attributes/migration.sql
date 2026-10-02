-- Mais atributos de variação: sabor (alimentos) e medida (peso/volume). Os valores entram pelo admin
-- ou pela importação.
INSERT INTO "attribute" ("attribute_id", "code", "name", "position", "updated_at") VALUES
  (uuidv7(), 'sabor', 'Sabor', 3, CURRENT_TIMESTAMP),
  (uuidv7(), 'medida', 'Peso / volume', 4, CURRENT_TIMESTAMP);
