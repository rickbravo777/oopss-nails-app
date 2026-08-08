# Deployment Guide

## Architecture

Single-container deployment: the `Dockerfile` at the repo root builds the frontend (React/Vite) and backend (Express/TypeScript) together — the Express server serves the built frontend as static assets and the `/api/v1/*` REST API from the same process. A separate `db` container runs PostgreSQL. See `docker-compose.yml` at the repo root and `design/architecture.md`.

## Prerequisites

- Docker and Docker Compose installed on the host (or EasyPanel, which provides this)
- An OpenAI API key (can be set via `.env` for first boot, or from the admin panel → Credentials afterward — see `design/architecture.md`, Credential Level Mapping)

## Environment Setup

1. Copy `.env.example` (repo root) to `.env`
2. Fill in all Level 1 values: `POSTGRES_PASSWORD`, `JWT_SECRET`, `CLIENT_SESSION_SECRET`, `ENCRYPTION_KEY` — generate random values for each, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Fill in Level 2 values: `ADMIN_INITIAL_EMAIL` / `ADMIN_INITIAL_PASSWORD` (first-run admin account — change the password after first login), `CORS_ALLOWED_ORIGIN` (your public domain)
4. `OPENAI_API_KEY` here is only a bootstrap fallback — the real place to set/rotate it is the admin panel once the app is running

## Local Deployment (verify before pushing to production)

```bash
docker compose up --build
```

- App: `http://localhost:3000` (serves both the site and `/api/v1/*`)
- On first boot, `prisma migrate deploy` runs automatically (see `Dockerfile` CMD) before the server starts
- Seed demo data (optional, for a fresh database): `docker compose exec app node -e "require('./dist/../prisma/seed')"` — or, more simply, run `npm run seed` locally against the same `DATABASE_URL` before containerizing

## Production Deployment (EasyPanel)

1. Connect the GitHub repository to EasyPanel
2. EasyPanel builds from the repo-root `Dockerfile` — no separate frontend/backend services needed, one app service + one Postgres service (or use EasyPanel's managed Postgres instead of the `db` service in `docker-compose.yml`)
3. Configure environment variables in EasyPanel matching `.env.example` (Level 1 as secrets, Level 2 as regular env vars)
4. Mount a persistent volume at `/app/uploads` (client-uploaded reference photos — losing this on redeploy is a real risk, see `planning/risks.md` R6)
5. Point the domain at the app service; EasyPanel handles TLS termination
6. Deploy — the container's `HEALTHCHECK` (`GET /health`) is what EasyPanel/Docker uses to confirm the app is up

## Backups

- Postgres: schedule regular `pg_dump` (or use EasyPanel's volume snapshot feature) — see `planning/risks.md` R5. Not yet automated as of this IT; must be configured before delivery.
- Uploads volume: back up alongside the database if photo history matters to the salon.

## Rollback Plan

Redeploy the previous known-good image/commit in EasyPanel. Since `prisma migrate deploy` runs additively on every boot, rolling back application code does not automatically revert schema migrations — if a rollback needs to undo a migration, that must be done manually (`prisma migrate resolve` / a down migration), not just by redeploying older code.

(Finalized further, if needed, during pre-delivery deployment preparation)
