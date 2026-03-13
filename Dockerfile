# ─── Stage 1: Build frontend ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server source (TypeScript compiled at runtime via tsx)
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create data directory for SQLite database
RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV DB_PATH=/data/medtrace.db
ENV PORT=3000

# Use non-root user
USER node

EXPOSE 3000

CMD ["node", "--import", "tsx/esm", "server.ts"]
