# Backend

Node.js + Express + TypeScript API for Oopss Nails. See `../design/stack_selection.md` and `../design/architecture.md` for rationale.

## Structure

- `src/config` — environment loading/validation (`env.ts`)
- `src/middleware` — Express middleware (error handling, auth guards as they're added)
- `src/routes` — route modules mounted under `/api/v1`
- `src/lib` — shared utilities (Prisma client, crypto helpers, etc. as they're added)
- `prisma/` — schema, migrations, seed script

## Local development

```bash
cp .env.example .env   # fill in JWT_SECRET, CLIENT_SESSION_SECRET, ENCRYPTION_KEY, DATABASE_URL
npm install
npm run dev
```

## Scripts

- `npm run dev` — start with hot reload (tsx watch)
- `npm run build` / `npm start` — production build + run
- `npm run lint` — ESLint
- `npm run prisma:migrate` — run Prisma migrations (dev)
- `npm run seed` — populate demo data
- `npm test` — Vitest
