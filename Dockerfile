# ============================================
# GESCOLA — Dockerfile multi-stage (Next.js standalone + pnpm)
#
# Usado no deploy da VPS (Docker + Traefik). O build gera a saída
# "standalone" do Next.js (ver next.config.mjs) e o runtime carrega
# apenas o server.js e o node_modules já "traced" pelo Next.
#
#   build:  docker build -t gescola-app:latest .
#   run:    docker run --rm -p 3000:3000 gescola-app:latest
#
# O .env NÃO entra na imagem (ver .dockerignore) — as variáveis chegam
# por `--env-file` / `environment:` no compose.
# ============================================

# ---------- Stage 1: dependências ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
# O schema do Prisma vem antes do install porque o postinstall roda
# `prisma generate` — sem o schema o install quebra.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: build ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate
RUN pnpm build

# ---------- Stage 3: migrations ----------
# Tem o app inteiro + o CLI do Prisma. Usado em `docker compose run --rm migrate`.
FROM builder AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "prisma", "migrate", "deploy"]

# ---------- Stage 4: runtime ----------
# libc6-compat: o sharp (otimizacao de imagem) precisa das libs de compatibilidade no alpine.
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl curl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
