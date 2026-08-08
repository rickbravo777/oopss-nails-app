# EasyPanel

- One "App" service built from the repo-root `Dockerfile` (GitHub-connected, auto-deploy on push).
- One "Postgres" service (EasyPanel's managed Postgres, or the `db` service from `../../docker-compose.yml` if self-managing).
- Environment variables: mirror `../../.env.example` — see `../docs/deployment_guide.md` for the full setup steps.
- Persistent volume required at `/app/uploads` inside the App service (client-uploaded reference photos).
- Domain + SSL: configured through EasyPanel's standard domain/TLS UI, pointed at the App service's port 3000.
