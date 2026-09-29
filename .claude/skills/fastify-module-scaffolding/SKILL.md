---
name: fastify-module-scaffolding
description: Use when adding a new domain/feature to apps/api in GeekStore — creating a new module under src/modules/, adding an endpoint, throwing a typed error, adding an env var, or adding/updating a shared request/response Zod schema in packages/shared (even from apps/web, since that package is consumed by both).
---

# Estrutura do `apps/api` (Fastify) — GeekStore

## Decisões deliberadas

**Duas decisões de estrutura:**

1. **Sem `@fastify/autoload`.** O padrão é registrar cada módulo manualmente em `app.ts` com prefixo
   explícito (`await app.register(xRoutes, { prefix: '/api/x' })`). Isso é intencional, não uma
   omissão — é mais rastreável que descoberta automática de pasta, e é o padrão já provado em
   produção. Siga isso, não a recomendação genérica de autoload da doc oficial do Fastify.
2. **Schemas Zod de contrato (request/response) vivem em `packages/shared`, não dentro do
   módulo.** O GeekStore compartilha contrato entre api e web (`CLAUDE.md`: "contratos ficam em
   `packages/shared`"; api e web consomem de lá, nunca duplicar schema) — ver seção própria
   abaixo.

## Convenções não-negociáveis deste monorepo (não são do Fastify, são nossas)

- **Sem extensão de arquivo em import relativo** (`from './env'`, nunca `from './env.js'`).
  Só é possível porque `packages/config/tsconfig.base.json` usa `moduleResolution: "Bundler"` +
  `module: "ESNext"`, e `apps/api` builda com **tsup** (esbuild, bundla tudo em um arquivo —
  não sobra import relativo pro Node resolver em runtime). Se algum dia trocar `tsup` por `tsc`
  puro, essa convenção quebra em produção (`node dist/server.js` não resolve extensionless
  import nativo) — não faça essa troca sem revisitar isto.
- **Aspas simples em todo o monorepo** — Biome (`biome.json` na raiz), não ESLint. Não existe
  ESLint neste projeto, foi removido a favor do Biome.
- **`process.env` só é lido dentro de `core/config/env.ts`.** Todo o resto do código lê
  `envConfig.<grupo>.<VAR>`, nunca `process.env.X` direto.

## Layout de `apps/api/src`

```
src/
├── app.ts                      # monta a instância Fastify, registra tudo, NÃO dá listen()
├── server.ts                   # só chama buildApp() + listen() — usa envConfig, não process.env
├── core/
│   ├── _errors/                # AppError + subclasses + errorHandler — já existe, ver abaixo
│   ├── config/
│   │   └── env.ts              # UM arquivo só: schema Zod + getEnv() + envConfig (getters agrupados)
│   ├── hooks/                  # (ainda não existe) — hooks transversais (ex.: audit-context)
│   └── plugins/
│       └── cors.plugin.ts      # já existe — referência viva de plugin com fp() (ver abaixo)
│           # (ainda faltam) helmet, rate-limit, jwt, bullmq, cron, swagger
└── modules/
    └── <feature>/
        ├── <feature>.routes.ts       # registra as rotas do domínio (path, method, schema)
        ├── <feature>.controller.ts   # lê request, chama o service, monta a reply
        ├── <feature>.service.ts      # regra de negócio: fala com @geekstore/db, lança AppError
        └── schemas/                  # SÓ tipos internos não-contratuais (ver seção de schemas)
```

**Duas formas, escolha pelo critério abaixo — não pelo tamanho do módulo:**

| Critério | Forma |
|---|---|
| Zero regra de negócio (retorno estático/derivado, sem persistência, sem decisão) | `<feature>.plugin.ts` + `<feature>.handler.ts` — só isso, sem `service.ts` |
| Existe regra de negócio (persistência via `@geekstore/db`, validação de estado, chamada externa, algo que possa lançar `AppError`) | `routes.ts` + `controller.ts` + `service.ts` completos |

Um módulo com uma única rota ainda ganha os três arquivos se aquela rota tem regra de negócio —
a divisão não é "vale a pena separar quando crescer", é "existe lógica pra isolar do HTTP ou
não". `health` é o único caso hoje que se qualifica pra forma enxuta.

**Referência viva no repo:** `apps/api/src/modules/health/` (`health.plugin.ts` +
`health.handler.ts`) é o exemplo real da forma enxuta — ainda não há módulo no repo usando a
forma completa; ao criar o primeiro, ele vira a referência viva dessa forma.

## Registrando um módulo novo em `app.ts`

```ts
// app.ts
import { xRoutes } from './modules/x/x.routes';

// ── Routes ────────────────────────────────────────────────────
app.register(healthPlugin); // sem prefixo — é infra, não domínio
app.register(xRoutes, { prefix: '/api/x' }); // domínio sempre com prefixo /api/<recurso>
```

Ordem de registro (mesmo que a maioria das camadas ainda não exista aqui):
**segurança → hooks → plugins → routes**. Ou seja, quando `core/plugins/helmet.plugin.ts`,
`rate-limit.plugin.ts`, `jwt.plugin.ts` etc. forem criados, eles entram **antes** do bloco
`// ── Routes ──` em `app.ts`, nessa ordem. Não pule essa ordem — cada camada depende do que a
anterior decorou na instância Fastify. `core/plugins/cors.plugin.ts` já existe — use como
referência viva.

**Todo plugin em `core/plugins/` precisa ser envolto em `fastify-plugin` (`fp()`).** Sem isso,
`app.register(meuPlugin)` cria uma nova encapsulação Fastify, e qualquer hook/decorator que o
plugin registra internamente (`fastify.addHook(...)`, `fastify.register(outroPlugin, ...)`) fica
preso àquela encapsulação — não alcança rotas registradas em outro lugar de `app.ts`. Foi
exatamente esse bug que aconteceu com o `cors.plugin.ts`: sem `fp()`, o header
`access-control-allow-origin` simplesmente não aparecia em nenhuma resposta, sem nenhum erro —
falha silenciosa. Sempre teste plugin novo de infra com uma request real (`curl -v` checando o
header/efeito esperado), não só typecheck — esse tipo de bug não aparece no build.

```ts
// core/plugins/cors.plugin.ts — padrão pra qualquer plugin de infra novo
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export const corsPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(cors, { origin: true });
});
```

## Erros — `core/_errors`

Já existe e está completo para o baseline atual: `AppError` (classe abstrata:
`status_code`, `error`, `code`) + `BadRequestError`, `NotFoundError`, `ConflictError`,
`UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ExternalApiError` + `errorHandler`
central registrado via `app.setErrorHandler(errorHandler)`.

**Regra:** módulos de negócio lançam (`throw`) a subclasse certa — nunca
`reply.status(409).send(...)` manual dentro de um handler/service para um erro esperado. O
`errorHandler` central é o único lugar que decide o formato da resposta.

```ts
// modules/products/products.service.ts
import { NotFoundError } from '../../core/_errors';

export async function getProductOrThrow(id: string) {
  const product = await findProduct(id);
  if (!product) throw new NotFoundError('Produto não encontrado');
  return product;
}
```

**Não adicionado ainda de propósito (YAGNI — adicionar quando a dependência existir de verdade,
não antes):**
- Mapeamento de erro do Prisma (`Prisma.PrismaClientKnownRequestError` etc.) — só faz sentido
  quando algum módulo realmente importar `@geekstore/db`. Quando isso acontecer, adicionar um `mapPrismaError` em
  `global-error-handler.ts` (erros do driver MySQL/MariaDB: `P2002` unique, `P2025` not found etc.).
- Captura em Sentry/BetterStack — GeekStore ainda não decidiu ferramenta de observabilidade. Não importar `@sentry/node` especulativamente.
- Handling de 429 (rate limit) — só faz sentido depois que `@fastify/rate-limit` for registrado.

## Env vars — `core/config/env.ts`

Um arquivo só (não dois): schema Zod + uma função `getEnv()` privada (valida via
`envSchema.safeParse`, lança se inválido) + `envConfig` exportado com getters agrupados por
domínio.

```ts
// core/config/env.ts
export const envConfig = {
  get server() {
    /* ... */
  },
  // ao adicionar um grupo novo (ex.: envConfig.payment), seguir o mesmo formato de getter
};
```

**Toda env var nova entra no `envSchema` primeiro** (com `.optional()` se não for obrigatória
em todo ambiente), depois ganha um getter agrupado em `envConfig`. Nunca `process.env.MINHA_VAR`
direto em código de módulo.

## Schemas Zod — onde cada tipo vai

Decida certo:

| Tipo de schema | Vai em | Por quê |
|---|---|---|
| Contrato de rota (request body/params/querystring, response) que a `web` também precisa conhecer | `packages/shared/src/<feature>.ts`, reexportado no barrel `packages/shared/src/index.ts`, importado em `apps/api` via `@geekstore/shared` | `CLAUDE.md`: "contratos ficam em `packages/shared`" — api e web consomem de lá, nunca duplicar schema |
| Tipo interno do módulo (config de gateway, shape de resposta de API externa, etc.) que a `web` nunca vê | `apps/api/src/modules/<feature>/schemas/` (local) | Não é contrato público — não pertence ao pacote compartilhado |

Na dúvida: se o tipo aparece em `schema.response`/`schema.body`/`schema.params` de uma rota
Fastify, é contrato → `packages/shared`. Se é só uma estrutura de dados interna do módulo, fica
local.

### Convenção dentro de `packages/shared`

**Um arquivo por feature** (`packages/shared/src/<feature>.ts`, não subpasta) — mesmo raciocínio
de "muitos arquivos pequenos" do `coding-style.md`, mas sem fragmentar demais um domínio que ainda
é pequeno. Nome do export: `<feature><Parte>Schema` em camelCase (`Body`/`Params`/`Query`/
`Response`), tipo inferido em PascalCase sem o sufixo `Schema`:

```ts
// packages/shared/src/product.ts
import { z } from 'zod';

import { dataResponse } from './common';

export const productBodySchema = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().positive(),
});
export type ProductBody = z.infer<typeof productBodySchema>;

export const productParamsSchema = z.object({
  product_id: z.string().uuid(),
});
export type ProductParams = z.infer<typeof productParamsSchema>;

export const productSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string(),
  price_cents: z.number().int(),
  status: z.enum(['active', 'archived']),
});
export type Product = z.infer<typeof productSchema>;

// Sucesso é sempre `{ data }`; lista é `{ data, meta }` (paginatedResponse) — ver "Padrão de resposta".
export const productResponseSchema = dataResponse(productSchema);
export type ProductResponse = z.infer<typeof productResponseSchema>;
```

```ts
// packages/shared/src/index.ts — barrel, reexporta cada feature
export * from './product';
```

**`apps/api` consome direto do pacote, nunca reescreve o schema:**

```ts
// modules/products/products.routes.ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { productBodySchema, productResponseSchema } from '@geekstore/shared';

import { createProductController } from './products.controller';

export async function productsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/',
    { schema: { body: productBodySchema, response: { 201: productResponseSchema } } },
    createProductController,
  );
}
```

Quando a `web` precisar do mesmo shape (formulário de produto, tipagem de resposta de fetch),
importa o mesmo `ProductBody`/`ProductResponse` de `@geekstore/shared` — nunca redeclara um
`interface`/`type` equivalente local. Isso é o ponto inteiro do pacote existir.

## Padrão de resposta (vale para toda rota)

Definido em `packages/shared/src/common.ts` e documentado em `docs/api/common-schemas.md`:

- **JSON em snake_case** (corpo, query params, enums). O Prisma já devolve os campos em snake_case
  (`user_id`, `price_cents`), então o service não converte nada. Só identificadores TypeScript
  locais são camelCase.
- **Sucesso:** `{ data }` via `dataResponse(schema)`; o controller responde `{ data: ... }`.
  **Lista:** `{ data: [...], meta: { page, page_size, total, total_pages } }` via
  `paginatedResponse(item)`, com query `paginationQuerySchema` (`page`, `page_size` padrão 20 e
  máximo 100, `sort=campo:asc|desc` validado contra os campos permitidos do recurso).
- **Erro:** sempre `{ error, code, message, details?, request_id }`; `code` é um dos
  `apiErrorCodes`. Quem formata é o `errorHandler` (e o `notFoundHandler` para rota inexistente),
  nunca o handler da rota. Novo código de erro = adicionar em `apiErrorCodes` primeiro.
- Criação retorna 201 com `{ data }`; exclusão e logout, 204 sem corpo. Sem `/v1`.

## Erros comuns a evitar

- Registrar rota via `@fastify/autoload` — este projeto não usa, registro é manual e explícito.
- Import relativo com `.js`/`.ts` no final — nunca aqui, `tsup`/`tsx` resolvem sem extensão.
- Ler `process.env.X` fora de `core/config/env.ts`.
- `reply.status(4xx).send(...)` manual pra um erro esperado dentro de um handler/service — jogue
  a `AppError` subclasse certa e deixe o `errorHandler` formatar.
- Responder um recurso sem `{ data }` ou uma lista sem `meta`, ou usar camelCase em campo de resposta/query.
- Colocar schema de contrato de rota dentro do módulo em vez de `packages/shared` — quebra a
  regra do `CLAUDE.md` de contratos em `packages/shared`.
- Adicionar `@sentry/node`, mapeamento de erro do Prisma, ou plugin de rate-limit
  especulativamente — só quando a dependência real (observabilidade escolhida, `@geekstore/db`
  importado, `@fastify/rate-limit` registrado) existir de fato.
- Trocar o build de `apps/api` de `tsup` para `tsc` sem also trocar a convenção de import de
  volta pra extensão explícita — as duas decisões são acopladas.
- Criar um plugin em `core/plugins/` sem envolver em `fp()` (`fastify-plugin`) — quebra
  silenciosamente (nenhum erro, só o efeito do plugin não acontece fora da própria
  encapsulação). Sempre testar plugin novo com uma request real, não só typecheck/build.

## Referências

- `.claude/skills/db-conventions/SKILL.md` — convenção de nomenclatura de tabela/model Prisma,
  usada quando o módulo precisa de uma tabela nova.
