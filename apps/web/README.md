# GeekStore — web

Frontend em Next.js 16 (App Router), React 19, TypeScript, HeroUI 3, Tailwind 4, TanStack Query/Table, Zustand e Lucide. Faz parte do monorepo `geekstore`; roda como servidor Next normal (sem exportação estática).

## Desenvolvimento

Na raiz do monorepo: `pnpm install`, depois `pnpm --filter web dev`. Validação: `pnpm --filter web typecheck`, `pnpm --filter web build`.

## Estrutura

`app/(store)` e `modules/store` são exclusivos da loja; `app/(admin)` e `modules/admin`, exclusivos do painel de gestão. `components/ui` e `lib` são compartilhados. Ver `APP_MODE` no `CLAUDE.md` da raiz.

## Implementado

Home, campanhas full-width com Swiper, categorias, busca, filtros, ordenação, favoritos, detalhes e zoom, seleção de tamanho, carrinho, checkout em etapas com cupom GEEK10, interfaces de cadastro/login, prévia administrativa com TanStack Table. Carrinho, favoritos e tema persistem no navegador via Zustand. Motion controla transições e alertas respeitando redução de movimento.

## Mascot configuration

All mascot assets live under `public/mascot/<outfit>/`. Original suit poses are preserved in `suit/`; the exclusive jacket is in `geekstore/`. Both outfits include hero, welcome, parcel, and search poses. Change `activeMascotOutfit` in `lib/mascot.ts` to switch the outfit everywhere, then rebuild and publish. Add future outfits to the typed registry. Missing poses reuse that outfit's hero. The brand logo stays independent. See `public/mascot/README.md`.

## Limites importantes

Não é uma loja pronta para receber vendas. Catálogo, estoque, descontos, entrega e condições comerciais são exemplos (`lib/catalog.ts`, dados em memória). Fotos externas ilustrativas não representam necessariamente os produtos. Não existem autenticação, pedidos reais, cobranças, persistência administrativa ou envio de formulários. A rota `/admin` é uma prévia pública sem dados privados nem controle de acesso real. Edições ali desaparecem ao recarregar. A raposa usa ilustrações estáticas com movimento CSS, não animação facial/esquelética.

## Próxima integração

Conectar `lib/catalog.ts` a uma API (M02 do `docs/SPEC.md`); implementar autenticação segura e autorização administrativa no servidor (M01/M11), banco para catálogo/pedidos/clientes, upload de imagens/banners, reserva de estoque e preços calculados no servidor. Escolher gateway e frete antes de implementar checkout real, webhooks verificados e idempotência (M08/M09). Nunca confiar em valores de localStorage para cobrar. Não armazenar senhas/cartões no navegador.

Substituir imagens, revisar políticas e dados legais, integrar e-mails transacionais, recuperação de senha e métricas com consentimento. Após catálogo real, ativar indexação (`robots.ts` bloqueia crawlers enquanto o catálogo for demonstrativo), metadados e dados estruturados de produtos.

## Identidade

Preto, amarelo e laranja; títulos Bangers, corpo Nunito, contornos e sombras sólidas de quadrinhos, centavos menores e leves. Fontes Google e fotos Unsplash exigem conectividade externa. Animações respeitam `prefers-reduced-motion`.
