# FactorIA-APP-TEMPLATE

Reusable project template for AI-assisted software development. Each project created from this template becomes an independent, deployable repository.

## Quick Start

1. Duplicate this repository for a new project
2. Fill in `START_PROJECT_PROMPT.md` with your project description
3. Run `/init-project` to begin planning
4. After plan approval, run `/start-execution` to begin building

## Structure

- `CLAUDE.md` — Governance and operating rules (read automatically)
- `planning/` — Requirements, scope, questions, risks
- `design/` — Architecture, data model, API contracts, UI wireframes
- `implementation/` — Task tracker and journey definitions
- `docs/` — Project memory, work log, decisions
- `deployment/` — Docker, EasyPanel, deployment scripts
- `backend/` — Backend application code
- `frontend/` — Frontend application code
- `tests/` — Automated tests

## Commands

| Command | Purpose |
|---------|---------|
| `/init-project` | Start planning a new project |
| `/start-execution` | Begin building after plan approval |
| `/session-start` | Resume work at start of session |
| `/review` | Independent quality review |
| `/iterate` | Post-delivery changes |
