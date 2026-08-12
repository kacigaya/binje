# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-slim AS deps
WORKDIR /app
# apps/mobile is a workspace member, so its manifest has to be present or the
# lockfile install fails. Its dependencies are never used by the web build.
COPY package.json bun.lock ./
COPY apps/mobile/package.json ./apps/mobile/package.json
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.14-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The /en and /fr routes prerender at build time and call TMDB, so the key must
# exist during the build. Mounted as BuildKit secrets rather than ARGs so they
# never land in an image layer or in `docker history`.
RUN --mount=type=secret,id=TMDB_API_KEY \
    --mount=type=secret,id=OMDB_API_KEY \
    --mount=type=secret,id=NEXT_PUBLIC_SITE_URL \
    TMDB_API_KEY="$(cat /run/secrets/TMDB_API_KEY)" \
    OMDB_API_KEY="$(cat /run/secrets/OMDB_API_KEY)" \
    NEXT_PUBLIC_SITE_URL="$(cat /run/secrets/NEXT_PUBLIC_SITE_URL)" \
    bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
