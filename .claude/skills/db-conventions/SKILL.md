---
name: db-conventions
description: Convenções de nomenclatura de banco de dados do GeekStore (PostgreSQL + Prisma). Use sempre que criar ou alterar uma tabela/model do Prisma, ou escrever SQL cru ($queryRaw/$executeRaw).
---

# Convenções de banco — GeekStore (PostgreSQL 18)

## Modelagem

- Toda chave primária é nomeada `{table_name}_id`, nunca `id` genérico. Ex.: `product_id`, `order_id`.
- Nomes de model, campo e tabela são em **inglês**.
- Tipo da PK é sempre UUID v7 (`@id @default(uuid(7)) @db.Uuid`), nunca int sequencial — mantém ordenação cronológica no índice e evita risco de enumeração. O PostgreSQL tem tipo `uuid` nativo (16 bytes), então FKs também levam `@db.Uuid`. Não use `@db.Char(36)`: ocupa mais que o dobro e compara mais devagar. O Prisma gera o v7 na aplicação; em SQL (seeds, migrações) use `uuidv7()`.
- Nome da tabela no banco via `@@map("table_name")` em snake_case singular, em inglês.
- O JSON da API também é snake_case (mesmos nomes do banco, ex.: `sku_id`, `created_at`, `price_cents`); o Prisma já devolve assim, sem conversão.
- Dinheiro sempre em centavos (`Int`/`BigInt`) ou `Decimal` com precisão explícita (`@db.Decimal(10, 2)`) — nunca `Float`.
- Datas: `DateTime` vira `timestamp(3)` sem fuso, sempre em UTC. O banco é criado com `timezone = 'UTC'` (migração baseline).
- Regras de integridade que o Prisma não expressa (`CHECK`, extensões, dados iniciais) vão no SQL da migração.

Exemplo:

```prisma
model Category {
  category_id String    @id @default(uuid(7)) @db.Uuid
  name        String
  products    Product[]

  @@map("category")
}

model Product {
  product_id  String   @id @default(uuid(7)) @db.Uuid
  category_id String   @db.Uuid
  category    Category @relation(fields: [category_id], references: [category_id])

  @@map("product")
}
```

## Migrações

- Versionadas; nunca edite uma migração já aplicada em algum ambiente. Corrija com uma nova.
- A exceção foi o baseline `init` (recriado na troca de MySQL para PostgreSQL, antes de existir dado real).
- Em CI e produção: `prisma migrate deploy`. O CI usa um `postgres:18` limpo, então a migração não pode depender de collation ou initdb especial.

## SQL cru no PostgreSQL

Prefira o Prisma Client. Quando o SQL cru for necessário (UPDATE condicional de estoque, travas, busca sem acento, agregações), use os helpers de `apps/api/src/core/db/sql.ts`:

- **Ids com `::uuid`** (`asUuid(id)`): os parâmetros chegam como texto e o PostgreSQL não compara `uuid = text`. Inteiros em aritmética ou comparação com `::int` (`asInt(n)`). Um teste que espera erro de SQL tem de checar a mensagem (ex.: o nome da constraint), senão passa por erro de tipo.
- **`user` é palavra reservada**: no SQL cru escreva `"user"` entre aspas. `role`, `location`, `type` e `position` não precisam.
- **Upsert**: `INSERT ... ON CONFLICT (colunas) DO UPDATE/NOTHING` (não existe `ON DUPLICATE KEY`). Em `DO UPDATE`, referencie a coluna existente com o nome da tabela (`stock_level.on_hand + ...`).
- **Trava de linha**: `SELECT ... FOR UPDATE`. Com `JOIN`, use `FOR UPDATE OF alias` para travar só a tabela que importa.
- **Agora**: `utcNow` (`now() AT TIME ZONE 'UTC'`), não `NOW(3)` nem `now()` puro, que é `timestamptz`.
- **Busca**: `containsInsensitive(coluna, termo)` = `unaccent(...) ILIKE unaccent(...)`. O `contains` do Prisma só ignora maiúsculas (`mode: 'insensitive'`), não acentos. O LIKE é sensível a maiúsculas no PostgreSQL (no MySQL não era).
- **NULLs na ordenação**: o PostgreSQL põe `NULL` por último em `ASC` e primeiro em `DESC` (o MySQL, ao contrário). Se a ordem importar, escreva `NULLS LAST`/`NULLS FIRST`.
- **Contagens**: `COUNT(*)` volta como `bigint` e `SUM(int)` como `bigint`/`numeric`; converta com `Number(...)`.
- **Isolamento**: o padrão é READ COMMITTED (no MySQL era REPEATABLE READ). A regra de estoque já não depende disso: a condição vai no próprio `UPDATE` e o `CHECK` do banco é a rede de segurança.
