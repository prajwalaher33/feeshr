FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
RUN npm ci --workspace=@feeshr/web

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web apps/web
COPY packages/types packages/types
COPY package.json tsconfig.json ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@feeshr/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Copy all node_modules from deps (standalone traces minimal deps but monorepo needs hoisted modules)
COPY --from=deps /app/node_modules ./node_modules
# Copy public and static assets
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
