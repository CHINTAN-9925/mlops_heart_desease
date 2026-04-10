# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# BACKEND_URL is baked into the Next.js rewrites at build time
ARG BACKEND_URL=http://backend:5001
ENV BACKEND_URL=${BACKEND_URL}

RUN mkdir -p public && npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=deps    /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
