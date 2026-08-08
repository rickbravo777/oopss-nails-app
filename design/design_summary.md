# Design Summary

Compact reference for the project. Generated after planning, updated when architecture changes.

This file is loaded every session — keep it under 50 lines.

## Stack

- Backend: Node.js + Express + TypeScript, layered (routes → controllers → services → repositories), Prisma migrations.
- Frontend: React + TypeScript + Vite, Tailwind CSS, React Query + lightweight Context/Zustand.
- DB: PostgreSQL 16, ~19 entities, UUID PKs, snapshot pattern on `AppointmentService` (price/duration frozen at booking time).
- Auth: JWT + bcrypt, admin role only. Clients use anonymous `sessionToken` (chat) or phone+confirmationCode (self-service), no password.

## Module Map

- Backend: 9 modules — auth, chat/assistant, services, specialists, availability, appointments, uploads, admin (credentials/dashboard/services/specialists+schedule/appointments/knowledge-base/escalations — all built as of M4).
- Frontend: public site (chat `/` — free-text AI + a single-tap click-only guided booking flow, `ServiceBookingFlow.tsx`, reachable three ways: the chat's welcome screen, a persistent "📅 Agendar cita" button, and inline mid-conversation via the AI's `offer_service_selection` tool call; `/servicios`, `/mis-citas`) + `/admin/*` (9 screens incl. a week/day/list appointments calendar, sidebar layout). Real brand logo wired into the chat header, admin login, admin sidebar, and favicon.

## Entity Overview

Client — name/phone — 1→N Appointment, Conversation. Specialist — name — N↔N Service via SpecialistService. Service — category/price/duration/requiresConsultation. ScheduleRule/Constraint/Exception — per-specialist availability rules. Appointment + AppointmentService — booking + line items. Conversation + Message — chat history, tool-call audit. PhotoUpload — nail/hair reference images. EscalationFlag — human handoff queue. AdminUser, Credential (Level-3 vault), TermSynonym, AssistantPolicy, ErrorLog.

## Key Patterns

- AI never states price/availability from memory — always via tool-calling into backend functions that read real data; backend re-validates before persisting (anti-hallucination, see risk R1).
- SpecialistService is a hard DB constraint — server rejects any specialist/service pairing not in this table, regardless of what the model decides (risk R2).
- Knowledge base = structured flags (requiresConsultation, ScheduleConstraint) + small set of editable text fragments (AssistantPolicy), deliberately not a rules engine (risk R7).
- Booking conflict prevention via DB transaction, not real-time infra (SSE only for chat token streaming).
- AI tool calls can drive frontend UI, not just fetch data — `offer_service_selection` has no backend effect; its only purpose is to appear in a message's `toolCallMeta` (persisted + streamed to the client) so the frontend knows to render a component (see DEC-13).

## Credential Map

- Level 1 (.env): DATABASE_URL, JWT_SECRET, CLIENT_SESSION_SECRET, ENCRYPTION_KEY, NODE_ENV, PORT
- Level 2 (deployment): OPENAI_MODEL, ADMIN_INITIAL_EMAIL/PASSWORD, CORS_ALLOWED_ORIGIN, UPLOADS_DIR, MAX_UPLOAD_SIZE_MB
- Level 3 (admin panel, encrypted): OPENAI_API_KEY (generic key-value Credential vault)

## Installed Skills & MCPs

No external MCP connectors selected (registry search for postgres/docker/github/openai/database/deployment/calendar/scheduling returned nothing relevant — see `mcps/inventory.md`). Built-in skills used during execution: `run` (launch/test in-browser), `security-review` (final audit) — see `skills/inventory.md`.
