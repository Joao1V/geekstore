# Geek Store — e-commerce próprio

Loja virtual própria da Geek Store (substitui a Tray; site atual: https://www.lojageekstore.com/), com catálogo controlado por SKU e preparada para vender em marketplaces (Mercado Livre, Shopee).

Requisitos, módulos, modelo de dados e plano por fases: @docs/SPEC.md. Consulte pelo ID (RF-XXX-NN, RNF-NN, D-N, F0..F7) e não reimplemente nada que já esteja decidido lá. Se o SPEC e o código divergirem, pare e pergunte.

## Estrutura

Monorepo pnpm + Turborepo:

- `apps/api`: Fastify, TypeScript, Prisma, MySQL 8, JWT. Única dona das regras de negócio.
- `apps/web`: Next (App Router), HeroUI, Zustand, React Query. Loja e admin no mesmo app, separados por `APP_MODE`.
- `packages/shared`: schemas Zod e tipos usados pela API e pelo web.
- `packages/db`: schema Prisma e client (MySQL). Só a `apps/api` importa daqui.
- `packages/config`: tsconfig. Lint e format com Biome (`biome.json` na raiz).

A base Next existente (tema da Geek Store) é o ponto de partida do `apps/web`. Adequá-la ao padrão e às skills do projeto faz parte da F0.

Infra: Dokploy num VPS, Traefik, Cloudflare. Fila BullMQ + Redis. Busca Meilisearch. Imagens em bucket S3-compatível atrás da Cloudflare.

## APP_MODE

`APP_MODE` = `store` | `admin` | `full`, definido no build (não em runtime).

- Código só da loja: `app/(store)/**` e `modules/store/**`. Só do admin: `app/(admin)/**` e `modules/admin/**`. Compartilhado: `components/ui` e `lib`.
- A loja nunca importa do admin e vice-versa (regra `noRestrictedImports` do Biome, com `overrides` por pasta).
- O Dockerfile apaga as pastas do outro modo antes do `next build`.
- O CI falha se o build `store` contiver rotas ou textos do admin.
- `basePath` também é definido no build.

## Regras de domínio (não quebrar)

- O SKU é a unidade. Preço, estoque, anúncio em marketplace e item de pedido apontam para o SKU, nunca para o produto.
- Dinheiro em centavos, inteiro, em todo o banco e na API.
- Estoque é livro-razão: saldo derivado de movimentações. A baixa é um UPDATE condicional dentro da transação do pedido, nunca leitura seguida de escrita. Estoque nunca fica negativo.
- Pedido congela valores, código e nome do SKU no momento da compra. Único por (canal, externalOrderId).
- Pagamentos e webhooks são idempotentes.
- Canais externos só entram por `ChannelConnector`; pagamento só por `PaymentProvider`.
- O `apps/web` nunca acessa o banco: só a API, por HTTP.
- Nenhum dado de cartão passa pelo servidor.
- Validação Zod em toda entrada; contratos ficam em `packages/shared`.

## Convenções

- Interface em pt-BR e BRL; identificadores de código em inglês; datas em UTC no banco.
- Páginas da loja em Server Components por padrão. HeroUI só nas partes interativas, com import por componente.
- Zustand só para UI e carrinho local; dados do servidor com React Query (prefetch no servidor e `HydrationBoundary`).
- URLs da loja seguem o padrão da Tray (`/categoria/subcategoria/slug`). Mudou URL, atualize o mapa de redirects 301.
- Migrações Prisma são versionadas; nunca editar migração já aplicada.
- Testes: unitários do domínio, integração da API com banco de teste, E2E do checkout em Playwright.
- Nomes de arquivo em `apps/web` são kebab-case, não PascalCase (diverge do exemplo genérico de `rules/react/coding-style.md`, mas é o padrão já estabelecido em todo o app — `admin-login.tsx`, `campaign-slider.tsx`, etc.). Um kit de componentes compartilhado que cresceria demais num arquivo só (ex.: `components/ui.tsx`) vira uma pasta com um arquivo por componente + `index.ts` de re-export — ver `components/ui/` e a skill `form-fields` pro caso da família `Field*`.

## Convenções de banco

- Chave primária de cada tabela: `{table_name}_id`, nunca `id` genérico (ex.: `sku_id`, `order_id`). Tipo UUID v7 em `CHAR(36)` (`@db.Char(36)`), nunca int sequencial. Nome da tabela em snake_case singular via `@@map`. Detalhes em `.claude/skills/db-conventions/SKILL.md`.

## Como trabalhar

- Antes de implementar um módulo, leia a seção dele no @docs/SPEC.md e o critério de saída da fase.
- Fase atual: F1. Atualize esta linha quando mudar de fase.
- Comandos (raiz): `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:fix`, `pnpm format`. Por app: `pnpm --filter @geekstore/db generate` (Prisma client). Testes: preencher quando o primeiro existir.
- Banco local: `docker compose up -d` (MySQL 8.4, porta 3306). Copie `packages/db/.env.example` para `packages/db/.env`.
- Não crie documentação além da pedida.
