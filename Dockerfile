# syntax=docker/dockerfile:1
# Containerized Next.js (standalone) for Azure App Service / Container Apps.
# Build the whole app with Bun; run the standalone server on Node. See docs/azure-migration.md.
# NOTE: needs a local `docker build -t claima-web .` smoke test before the first deploy — this
# file could not be build-tested in-repo.

# ---- deps: install with the frozen lockfile ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- builder: prisma generate + next build (emits .next/standalone) ----
FROM oven/bun:1 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build   # package.json build = "prisma generate && next build"

# ---- runner: minimal Node image running the standalone server ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs

# Standalone server + static assets (Next traces the needed node_modules into standalone/)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma generated client (driver-adapter mode = no native engine, but the generated client
# under node_modules/.prisma is sometimes missed by Next's tracer — copy it explicitly).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
