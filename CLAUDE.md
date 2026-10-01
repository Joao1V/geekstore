# Geek Store — e-commerce próprio

Loja virtual própria da Geek Store (substitui a Tray; site atual: https://www.lojageekstore.com/), com catálogo controlado por SKU e preparada para vender em marketplaces (Mercado Livre, Shopee).

Requisitos, módulos, modelo de dados e plano por fases: @docs/SPEC.md. Consulte pelo ID (RF-XXX-NN, RNF-NN, D-N, F0..F7) e não reimplemente nada que já esteja decidido lá. Se o SPEC e o código divergirem, pare e pergunte.

## Estrutura

Monorepo pnpm + Turborepo:

- `apps/api`: Fastify, TypeScript, Prisma, PostgreSQL 18, JWT. Única dona das regras de negócio.
- `apps/web`: Next (App Router), HeroUI, Zustand, React Query. Loja e admin no mesmo app, separados por `APP_MODE`.
- `packages/shared`: schemas Zod e tipos usados pela API e pelo web.
- `packages/db`: schema Prisma e client (PostgreSQL). Só a `apps/api` importa daqui.
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
- O `apps/web` nunca acessa o banco: só a API, por HTTP. Toda chamada à API no web é um service (`modules/<store|admin>/services/<domain>/`, skill `scaffolding-api-service`, só para `apps/web`), sem `fetch` solto em componente.
- Nenhum dado de cartão passa pelo servidor.
- Validação Zod em toda entrada; contratos ficam em `packages/shared`.
- Padrão da API (`docs/api/common-schemas.md`, schemas em `packages/shared/src/common.ts`): JSON em snake_case (corpo, query, enums, banco); sucesso `{ data }`, lista `{ data, meta: { page, page_size, total, total_pages } }` com query `page`/`page_size`/`sort`; erro `{ error, code, message, details?, request_id }` com `code` de `apiErrorCodes`. Sem `/v1`.
- O browser chama a API pela mesma origem (`/api/*`, rewrite do Next → `API_INTERNAL_URL`); o servidor do Next e os webhooks vão direto na API. `TRUST_PROXY_HOPS` na API deve refletir os proxies confiáveis à frente dela (rate limit por IP).

## Convenções

- Interface em pt-BR e BRL; identificadores de código em inglês; datas em UTC no banco.
- Páginas da loja em Server Components por padrão. HeroUI só nas partes interativas, com import por componente.
- Zustand é o único estado global (UI, sessão, carrinho local); nada de `createContext`/`useContext` nem `useReducer` no nosso código (providers de libs como React Query e HeroUI são ok). Dados do servidor com React Query (prefetch no servidor e `HydrationBoundary`).
- HeroUI v3 (`@heroui/react`): antes de usar ou customizar um componente, consulte a doc dele em markdown: índice https://www.heroui.com/react/llms.txt, componentes https://www.heroui.com/react/llms-components.txt, padrões https://www.heroui.com/react/llms-patterns.txt (página de cada componente: `https://heroui.com/en/docs/react/components/<nome>`). Não adivinhe props nem partes de compound components.
- URLs da loja seguem o padrão da Tray (`/categoria/subcategoria/slug`). Mudou URL, atualize o mapa de redirects 301.
- Migrações Prisma são versionadas; nunca editar migração já aplicada.
- Testes: unitários do domínio, integração da API com banco de teste, E2E do checkout em Playwright.
- Estilo em `apps/web`: Tailwind, com as classes no próprio componente. O `app/globals.css` só tem base (reset, tema, `@theme`) e `@utility` para o que se repete em várias telas (`wrap`, `section`, `eyebrow`, `section-title`, `action`...). Nada de classe de componente nova no `globals.css`. Regra de elemento ou de classe fora de `@layer` vence utilitário do Tailwind: se precisar de regra global, ponha em `@layer base`.
- Tamanho de fonte só pela escala do Tailwind (`text-xs`, `text-sm`...) ou pelo token `text-2xs` (micro texto, 11px), nunca `text-[Npx]`: tudo em `rem`, para escalar com a fonte do navegador. Cores só por token, nunca hex no componente: tema (`bg-surface`, `text-muted`, `border-border`), marca (`geek-yellow`, `ink`), cromo escuro fixo (`night`, `night-raised`, `night-fg`, `night-muted`) e status (`status-success|warning|info|error`); cor nova vira token no `@theme` de `apps/web/app/globals.css` (o prefixo `status-` evita colidir com `success`/`warning`/`danger` do HeroUI). Sombra em preto translúcido é a única exceção. Dark mode com `dark:` (ligado ao `data-theme`); breakpoints `max-md:` (até 767px) e `max-tablet:` (até 1050px).
- Nomes de arquivo em `apps/web` são kebab-case, não PascalCase (diverge do exemplo genérico de `rules/react/coding-style.md`, mas é o padrão já estabelecido em todo o app — `admin-login.tsx`, `campaign-slider.tsx`, etc.). Um kit de componentes compartilhado que cresceria demais num arquivo só (ex.: `components/ui.tsx`) vira uma pasta com um arquivo por componente + `index.ts` de re-export — ver `components/ui/` e a skill `form-fields` pro caso da família `Field*`.

## Convenções de banco

- Chave primária de cada tabela: `{table_name}_id`, nunca `id` genérico (ex.: `sku_id`, `order_id`). Tipo UUID v7 nativo (`@db.Uuid`), nunca int sequencial. Nome da tabela em snake_case singular via `@@map`. SQL cru (`$queryRaw`/`$executeRaw`) tem regras próprias do PostgreSQL: `::uuid` nos ids, `"user"` entre aspas, busca com `unaccent`. Detalhes em `.claude/skills/db-conventions/SKILL.md`.
- Itens vindos de outro sistema (ERP) guardam o código de origem em `legacy_code` (único) e o restante da linha em `legacy_data`; a importação é sempre pela `legacy_code`, para ser repetível.

## Como trabalhar

- Referência da API: antes de assumir o formato de um payload, leia `docs/api/README.md` (por recurso, com as regras de negócio). É gerada da spec da `apps/api` (`/documentation/json`) pelo comando `/openapi-docs`; não edite à mão. Se o front precisa de algo que não está lá, é pedido ao backend.
- Antes de implementar um módulo, leia a seção dele no @docs/SPEC.md e o critério de saída da fase.
- Fase atual: F1. Atualize esta linha quando mudar de fase.
- Comandos (raiz): `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:fix`, `pnpm format`. Por app: `pnpm --filter @geekstore/db generate` (Prisma client). Testes: `pnpm test` (unitários); integração com banco real em `apps/api`: `pnpm test:integration` (precisa do PostgreSQL no ar e das migrações aplicadas: `pnpm --filter @geekstore/db exec prisma migrate deploy`).
- Banco local: `docker compose up -d` (PostgreSQL 18, porta 5434; as portas 5432/5433 costumam estar ocupadas por outros projetos). Copie `packages/db/.env.example` para `packages/db/.env`.
- Não crie documentação além da pedida.
