# syntax=docker/dockerfile:1
#
# Build a partir da RAIZ do monorepo, não desta pasta:
#   docker build -f apps/api/Dockerfile -t geekstore-api .
#
# node:24-bookworm-slim (glibc), não alpine: o argon2 só publica binário nativo
# pré-compilado pra glibc (darwin/linux-x64/linux-arm64), não pra musl do alpine.

FROM node:24-bookworm-slim AS base
RUN corepack enable
# Prisma precisa de OpenSSL pra detectar o engine certo em tempo de build/runtime,
# mesmo usando o driver adapter (@prisma/adapter-mariadb) em vez do engine nativo.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# ── Etapa 1: poda o monorepo só com o que o apps/api precisa (turbo prune) ──
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.13 prune api --docker

# ── Etapa 2: instala dependências a partir do subconjunto podado ──
# Camada separada da de build para o cache do Docker não invalidar a instalação
# inteira a cada mudança de código-fonte, só quando package.json/lockfile mudam.
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ── Etapa 3: build ──
FROM base AS builder
WORKDIR /app
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .

# `prisma generate` (build de @geekstore/db) só precisa da variável presente pra
# não falhar ao carregar o prisma.config.ts — não conecta de verdade nesta etapa.
# O DATABASE_URL de produção é injetado em runtime pelo Dokploy, nunca fica na imagem.
ARG DATABASE_URL="mysql://build:build@localhost:3306/build"
ENV DATABASE_URL=$DATABASE_URL
RUN pnpm turbo run build --filter=api

# ── Etapa 4: dependências só de produção ──
# node_modules separado do da etapa de build: sem typescript/tsup/vitest/prisma-cli/etc.
# (essas só existem pra compilar, não pra rodar) — é isso que deixa o runtime bem menor.
FROM base AS prod-deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --prod --frozen-lockfile
# `@prisma/client` declara `prisma` e `typescript` como peer dependencies opcionais, e o
# autoInstallPeers do lockfile instala eles (e toda a árvore do Prisma Studio atrás deles —
# React, uma lib de introspecção de schema com D3, etc.) mesmo com --prod. --frozen-lockfile
# não deixa desligar isso via config nesta etapa (só re-resolvendo o lockfile todo, o que é
# uma mudança maior que não faz sentido só por isso), então limpa depois do install: nada
# disso é importado em runtime quando não se usa a CLI/Studio do Prisma.
RUN find node_modules/.pnpm -maxdepth 1 -type d \( \
      -name "prisma@*" -o \
      -name "@prisma+studio-core@*" -o \
      -name "@prisma+dev@*" -o \
      -name "@prisma+query-plan-executor@*" -o \
      -name "@electric-sql+pglite*" -o \
      -name "effect@*" -o \
      -name "elkjs@*" -o \
      -name "remeda@*" -o \
      -name "fast-check@*" -o \
      -name "lodash@*" -o \
      -name "typescript@*" -o \
      -name "@typescript+*" -o \
      -name "@types+*" -o \
      -name "@radix-ui+*" -o \
      -name "react-dom@*" -o \
      -name "valibot@*" \
    \) -exec rm -rf {} + \
    && rm -rf node_modules/prisma node_modules/typescript node_modules/@types \
    && rm -f node_modules/.bin/prisma node_modules/.bin/tsc node_modules/.bin/tsserver

# ── Etapa 5: runtime ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 fastify && useradd --system --uid 1001 --gid fastify fastify

# node_modules de produção + os arquivos que o build realmente gerou (dist do api,
# dist e client do Prisma gerado do db). @geekstore/shared não entra aqui: o tsup já
# empacotou ele dentro do dist (ver noExternal em tsup.config.ts), não é resolvido
# como módulo externo em runtime.
#
# O pnpm guarda o conteúdo compartilhado em node_modules/.pnpm na raiz, mas os
# symlinks que cada pacote do workspace realmente usa (import '@fastify/swagger' etc.)
# ficam dentro do node_modules de CADA pacote (apps/api/node_modules,
# packages/db/node_modules) — copiar só o node_modules da raiz não é suficiente,
# resolução de módulo quebra em runtime mesmo com o pacote presente no .pnpm.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/generated ./packages/db/generated

USER fastify
EXPOSE 3333
CMD ["node", "apps/api/dist/server.js"]
