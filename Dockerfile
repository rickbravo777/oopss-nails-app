# Single-container build: Express backend serves both the API and the built React frontend
# static assets (see design/architecture.md — Deployment). Built from the repo root so it can
# reach both backend/ and frontend/.

# ---- frontend build ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- backend build ----
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY backend/package*.json ./
# prisma/schema.prisma must exist before `npm ci`, since @prisma/client's postinstall hook
# runs `prisma generate` against it — copying it first (not after) avoids that failing/warning.
COPY backend/prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

RUN mkdir -p /app/uploads && chown -R app:app /app

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Applies any pending migrations, then starts the server — safe to run on every boot
# (prisma migrate deploy is a no-op if the DB is already up to date).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
