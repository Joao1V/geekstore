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

# ── Etapa 4: runtime ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 fastify && useradd --system --uid 1001 --gid fastify fastify
COPY --from=builder /app .
USER fastify

EXPOSE 3333
CMD ["node", "apps/api/dist/server.js"]
