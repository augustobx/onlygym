# OnlyGym production image
# - migrate target keeps Prisma CLI only for the short-lived migration job
# - runner target contains only the Next.js standalone runtime traced by Next
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# 1. Full dependency graph used by build and migration tooling.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci

# 2. Build application and generate Prisma Client.
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . ./
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-only placeholders. The runner never inherits these values.
RUN BETTER_AUTH_SECRET="onlygym-build-stage-placeholder-never-use-at-runtime" \
    BETTER_AUTH_URL="http://localhost:3000" \
    npm run build

# 3. Short-lived migration/bootstrap image.
# Prisma CLI remains here, isolated from the public web runtime.
FROM deps AS migrate
WORKDIR /app
COPY scripts ./scripts
ENV NODE_ENV=production

# 4. Public web runtime. Next standalone output contains only traced runtime files.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/data/progress-photos \
    && chown -R nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
