---
name: db-conventions
description: Convenções de nomenclatura de banco de dados do GeekStore (MySQL + Prisma). Use sempre que criar ou alterar uma tabela/model do Prisma.
---

# Convenções de banco — GeekStore (MySQL)

- Toda chave primária é nomeada `{table_name}_id`, nunca `id` genérico. Ex.: `product_id`, `order_id`.
- Nomes de model, campo e tabela são em **inglês**.
- Tipo da PK é sempre UUID v7 (`@id @default(uuid(7)) @db.Char(36)`), nunca int sequencial — mantém ordenação cronológica no índice e evita risco de enumeração. MySQL não tem tipo `UUID` nativo, então usa-se `CHAR(36)` (não `@db.Uuid`, que é só Postgres). FKs também levam `@db.Char(36)`.
- Nome da tabela no banco via `@@map("table_name")` em snake_case singular, em inglês.
- Dinheiro sempre em centavos (`Int`/`BigInt`) ou `Decimal` com precisão explícita (`@db.Decimal(10, 2)`) — nunca `Float`.

Exemplo:

```prisma
model Category {
  category_id String    @id @default(uuid(7)) @db.Char(36)
  name        String
  products    Product[]

  @@map("category")
}

model Product {
  product_id  String   @id @default(uuid(7)) @db.Char(36)
  category_id String   @db.Char(36)
  category    Category @relation(fields: [category_id], references: [category_id])

  @@map("product")
}
```
