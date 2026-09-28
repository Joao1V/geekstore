# syntax=docker/dockerfile:1
#
# Build a partir da RAIZ do monorepo, não desta pasta:
#   docker build -f apps/web/Dockerfile --build-arg APP_MODE=store -t geekstore-web-store .
#   docker build -f apps/web/Dockerfile --build-arg APP_MODE=admin -t geekstore-web-admin .
#
# APP_MODE (D2): store | admin | full (default). O build store/admin apaga a pasta do
# modo não usado ANTES do `next build` — é isso que garante que o bundle público da loja
# nunca contenha código/rota do admin (R6), não só a separação de import do Biome.

FROM node:24-alpine AS base
RUN corepack enable
RUN apk add --no-cache libc6-compat

# ── Etapa 1: poda o monorepo só com o que o apps/web precisa (turbo prune) ──
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.13 prune web --docker

# ── Etapa 2: instala dependências a partir do subconjunto podado ──
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ── Etapa 3: build ──
FROM base AS builder
WORKDIR /app
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .

ARG APP_MODE=full
ARG BASE_PATH=""
ENV BASE_PATH=$BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN if [ "$APP_MODE" = "store" ]; then \
      echo "APP_MODE=store: removendo app/(admin) e modules/admin"; \
      rm -rf "apps/web/app/(admin)" apps/web/modules/admin; \
    elif [ "$APP_MODE" = "admin" ]; then \
      echo "APP_MODE=admin: removendo app/(store) e modules/store"; \
      rm -rf "apps/web/app/(store)" apps/web/modules/store; \
    fi

RUN pnpm turbo run build --filter=web

# ── Etapa 4: runtime (usa a saída standalone do Next — ver next.config.ts) ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
