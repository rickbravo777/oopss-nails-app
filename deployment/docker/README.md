# Docker

The actual `Dockerfile` lives at the repo root (not in this folder) because it needs to build both `frontend/` and `backend/` in the same multi-stage build — a single container serves both. See `../docs/deployment_guide.md` for usage.

No nginx/reverse proxy is used — Express serves the built frontend static assets directly (see `backend/src/app.ts`), and EasyPanel/the deployment host handles TLS termination in front of the container.
