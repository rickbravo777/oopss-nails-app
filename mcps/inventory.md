# MCPs & External APIs Inventory

Registry of available, selected, and rejected MCPs and external APIs.

| Name | Type | Status | Notes |
|------|------|--------|-------|
| OpenAI API | External API | selected | Core AI provider for the conversational assistant (governance default), integrated directly via the `openai` npm SDK behind an `AIProvider` interface — no MCP wrapper needed for a direct SDK call from the backend. |
| MCP connector registry search (postgres, docker, github, openai, database, deployment, calendar, scheduling) | MCP | rejected | Searched during planning (2026-08-03) — no relevant connectors returned. That registry is oriented at SaaS/productivity integrations (Slack, Jira, etc.), not developer infrastructure; nothing there fits a self-hosted Docker/Postgres/Prisma stack. |
| WhatsApp Business API | External API | rejected | Explicitly out of scope per user decision (DEC-01 in `docs/decision_log.md`) — chat is web-only in v1. |
| Instagram Graph API | External API | rejected | Same as above — web-only channel decision. |
| Google Calendar API | External API | rejected | Explicitly out of scope per user decision (DEC-02) — calendar is self-contained in the app. |
| Stripe (or similar payment gateway) | External API | rejected | Out of scope per user decision (DEC-03) — no deposit/payment collection in v1; flagged as a future-iteration item if the salon later wants deposits. |

## Evaluation Criteria

- Does the MCP/API solve a real project need?
- Is it reliable and well-maintained?
- What are the cost and rate limit implications?

(Populated during planning with /init-project)
