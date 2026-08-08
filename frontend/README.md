# Frontend

React + TypeScript + Vite + Tailwind CSS client for Oopss Nails. See `../design/stack_selection.md`, `../design/style_guide.md`, and `../design/ui_wireframes.md`.

## Structure

- `src/pages` — route-level pages (public site + `pages/admin` for the admin panel)
- `src/layouts` — shared layout shells (added in IT-09 for the admin panel)
- `src/components` — reusable UI components
- `src/lib` — API client, query hooks, utilities
- `src/index.css` — Tailwind import + theme CSS variables (light/dark, glassmorphism tokens)

## Local development

```bash
npm install
npm run dev
```

The dev server proxies `/api` to `http://localhost:3000` (see `vite.config.ts`), so run the backend alongside it.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — type-check + production build
- `npm run lint` — oxlint
