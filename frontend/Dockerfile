# ── Build stage ──────────────────────────────────────────────
# Raspberry Pi (arm64) compatible
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ── Runtime stage (standalone output) ────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# bind on all interfaces so the cloudflared container can reach the frontend
ENV HOSTNAME=0.0.0.0

# Next.js standalone bundle
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public/ holds a .gitkeep so this COPY resolves even with no static assets
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
