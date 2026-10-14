# syntax=docker/dockerfile:1

FROM oven/bun:1.4.0-slim AS deps
WORKDIR /app
# Frozen installs need the mobile workspace manifest, even for web-only builds.
COPY package.json bun.lock ./
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY patches ./patches
RUN bun install --frozen-lockfile

FROM oven/bun:1.4.0-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Prerendering needs API keys at build time; use BuildKit secrets to keep them out of image layers and history.
RUN --mount=type=secret,id=TMDB_API_KEY \
    --mount=type=secret,id=OMDB_API_KEY \
    TMDB_API_KEY="$(cat /run/secrets/TMDB_API_KEY)" \
    OMDB_API_KEY="$(cat /run/secrets/OMDB_API_KEY)" \
    bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# ffmpeg decodes stream audio for /api/subtitles/sync.
RUN apk add --no-cache ffmpeg && addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
