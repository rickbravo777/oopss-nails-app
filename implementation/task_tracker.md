# Task Tracker

## Tracking Table

| ID | Type | Name | Milestone | Status | Security Checked | Review Passed | Notes |
|----|------|------|-----------|--------|------------------|---------------|-------|
| IT-01 | IT | Repo & stack scaffolding | M0 | completed | yes | yes | Backend (Express+TS) and frontend (React+Vite+Tailwind) boot cleanly, lint clean, build clean |
| IT-02 | IT | Database schema & migrations | M0 | completed | yes | yes | Full Prisma schema (19 entities) migrated against a real local Postgres 17 instance; seed skeleton verified |
| IT-03 | IT | Admin auth system | M0 | completed | yes | yes | JWT+bcrypt login/me verified live against seeded admin; 7 automated tests passing |
| IT-04 | IT | Client identification mechanism | M0 | completed | yes | yes | Chat session issuance + phone/code lookup/cancel verified live and with 15 automated tests total |
| IT-05 | IT | OpenAI SDK integration wrapper | M0 | completed | yes | yes | AIProvider + tool-calling loop + SSE plumbing; 12 automated tests (mocked, no real API key needed yet) |
| IT-06 | IT | Credential vault | M0 | completed | yes | yes | AES-256-GCM encryption verified live (real DB row confirmed encrypted, not plaintext); IT-05's TODO resolved |
| IT-07 | IT | File upload handling | M0 | completed | yes | yes | Verified live (real image upload+retrieval+auth checks) and 8 automated tests; corrected PhotoUpload.clientId to nullable (DEC-06) |
| IT-08 | IT | Docker & EasyPanel deployment config | M0 | completed | yes | yes | Config written + YAML-validated + reviewed; **not** live-verified with `docker build`/`compose up` — Docker isn't installed in this dev environment (see work_log) |
| IT-09 | IT | Admin panel shell | M0 | completed | yes | yes | Verified live in-browser: guard redirect, login, nav, theme toggle, logout all work; login page effectively completes UJ-11's frontend too |
| IT-10 | IT | Health/observability primitives | M0 | completed | yes | yes | Verified live against real DB (health checks + ErrorLog capture); 55 tests total in suite |
| UJ-01 | UJ | Browse services/prices via chat | M1 | completed | yes | yes | Verified live with real OpenAI key: asked price of Balayage, got real $120 "desde" price via get_service_info (toolCallMeta confirms no hallucination) |
| UJ-02 | UJ | Identify exact service via guided questions + term-equivalence | M1 | completed | yes | yes | Verified live: "pintura en gel en las manos" correctly resolved to Manicure Gel ($24, Tania/Mariangely); generic "quiero hacerme las uñas" correctly triggered a clarifying question instead of assuming |
| UJ-03 | UJ | Browse the service catalog via /servicios | M1 | completed | yes | yes | Fully verified live in-browser: 10 categories, correct prices/"desde"/duration, category switching, no AI dependency |
| UJ-04 | UJ | Ask which specialist performs a given service | M1 | completed | yes | yes | Verified live via chat: "¿Quién hace Rubber Gel?" correctly answered Yez, Tania, Mariangely |
| UJ-05 | UJ | Upload a reference photo within an ongoing chat | M1 | in_progress | yes | no | Attach button + upload wiring built on top of IT-07's already-verified endpoint; not yet re-verified live in-browser (no file-picker simulation available in this session's browser tool) |
| UJ-06 | UJ | Check specialist availability | M2 | completed | yes | yes | Verified live: Yez Saturday 5pm cutoff, Ana María 11am start, both exact per acceptance criteria; 9 automated tests |
| UJ-07 | UJ | Book an appointment end-to-end via chat | M2 | completed | yes | yes | Full real conversation with live OpenAI booked a real appointment (confirmation code, correct price/duration); double-booking blocked with 409 (verified live). Post-delivery: extended with a non-AI, click-only guided path (categoría→servicio→especialista→fecha→hora→confirmar) — as a modal (`GuidedBooking.tsx`) and as the chat's own welcome screen with multi-category checkboxes (`ChatWelcome.tsx`), sharing logic via `useBookingFlow.ts`/`BookingStepsPanel.tsx`; see `docs/work_log.md` iterations #2–#3 |
| UJ-08 | UJ | View an upcoming appointment via phone + confirmation code | M2 | completed | yes | yes | Backend from IT-04 + new `/mis-citas` frontend, verified live in-browser |
| UJ-09 | UJ | Cancel or reschedule an upcoming appointment | M2 | completed | yes | yes | Scope extended to include reschedule per explicit user request (DEC-08); both verified live in-browser end-to-end, including a real response-shape bug found and fixed; {M1+M2} review's critical auth-gap finding on booking creation fixed post-review |
| UJ-10 | UJ | Human escalation handoff | M2 | completed | yes | yes | Verified live: ambiguous facial question correctly escalated to Sonia, EscalationFlag + conversation status confirmed in DB |
| UJ-11 | UJ | Admin login | M3 | completed | yes | yes | Frontend was already built in IT-09; re-verified live end-to-end (correct login → dashboard, wrong credentials → generic error, no enumeration) |
| UJ-12 | UJ | Admin dashboard / lifecycle visibility | M3 | completed | yes | yes | Extended `GET /admin/dashboard/health` with `todayAppointments`; new `/admin` dashboard page verified live with real DB/OpenAI/disk/escalation/appointment data |
| UJ-13 | UJ | Manage services & prices | M3 | completed | yes | yes | Admin CRUD for Service + ServiceCategory (soft delete via `active=false`); verified live: price edit on Manicure Regular reflected immediately on public `/servicios`, deactivate/reactivate round-tripped correctly |
| UJ-14 | UJ | Manage staff and their allowed services | M3 | completed | yes | yes | `PUT /admin/specialists/:id/services` full-replace; verified live: unassigning Relleno Polygel from Yez immediately removed her from `GET /services/:id`'s specialists list, reassigning restored it |
| UJ-15 | UJ | Manage specialist schedules | M3 | completed | yes | yes | Weekly rules + constraints (full replace) + exceptions (individual CRUD); verified live: adding a day-off exception for Yez dropped her `/availability/check` slots from 18 to 0 on that date; a real bug (schedule-exception date sent as bare string, Prisma expected full ISO datetime) was found and fixed during this verification |
| UJ-16 | UJ | View and manage appointments | M4 | completed | yes | yes | `GET/PUT /admin/appointments`; edit reuses `rescheduleAppointment()` so conflict rules match booking exactly. Verified live: create via admin token, list+filter by specialist, reschedule + status/notes edit, cleaned up after. Post-delivery: rebuilt as a visual week/day/list calendar with per-specialist colors (`dateFrom`/`dateTo` range added to the GET endpoint); see `docs/work_log.md` iteration #1 |
| UJ-17 | UJ | Manage credentials (OpenAI key) | M4 | completed | yes | yes | Backend already existed (IT-06); built `/admin/credenciales` frontend. Verified live end-to-end with the real OpenAI key (round-tripped through the vault, masked correctly, OpenAI health check stayed "Configurado" — key never echoed in any response) |
| UJ-18 | UJ | Edit knowledge base (synonyms + policy text) | M4 | completed | yes | yes | `GET/POST/DELETE /admin/knowledge-base/synonyms`, `GET/PUT/DELETE /admin/knowledge-base/policies`. Verified live: added/deleted a test synonym and policy, confirmed all 6 real seeded synonyms intact after (one was accidentally deleted mid-verification by an imprecise browser click and immediately restored via API) |
| UJ-19 | UJ | Resolve the escalation queue | M4 | completed | yes | yes | `GET/PUT /admin/escalations/:id/resolve`. Verified live: created a test escalation, resolved it via the UI, confirmed it moved from "Abiertos" to "Resueltos" with the resolution note, cleaned up after. `{M3+M4}` review found the "enlace a la conversación" specified in `design/ui_wireframes.md`/`user_journeys.md` was missing from the Frontend; fixed post-review (new `GET /admin/conversations/:id` + inline transcript view in `EscalationsAdminPage.tsx`) |

## Milestones

Milestones group related work units for review purposes. Run `/review` after each milestone completes.

- **M0: Foundation** — IT-01 through IT-10. All Infrastructure Tasks.
- **M1: Client Chat & Discovery** — UJ-01 through UJ-05. Browsing services, service identification, catalog page, specialist lookup, photo upload.
- **M2: Booking Flow** — UJ-06 through UJ-10. Availability check, end-to-end booking, self-service view/cancel, human escalation.
- **M3: Admin Foundations** — UJ-11 through UJ-15. Admin login, dashboard, services/staff/schedule management.
- **M4: Admin Operations & Governance** — UJ-16 through UJ-19. Appointments management, credentials, knowledge base, escalation queue.

`/review` runs after M0, after {M1+M2} as a group, after {M3+M4} as a group, and mandatorily before delivery.

## Post-Delivery Iterations

Change requests handled after delivery (`/iterate`). Not IT/UJ work units — tracked here as a navigation index; full detail for each is in `docs/work_log.md` (dated entries) and `docs/project_memory.md`'s Recent Changes.

| # | Date | Summary | Status |
|---|------|---------|--------|
| 1 | 2026-08-04 | Real brand color palette (from catalog PDF pixel sampling) + visual week/day/list appointments calendar with per-specialist colors | completed |
| 2 | 2026-08-04 | Click-only guided booking modal (`GuidedBooking.tsx`), bypasses the AI for the mechanical booking steps | completed |
| 3 | 2026-08-04 | Chat welcome screen with a multi-category checklist (later superseded by #6's single-tap redesign) | completed |
| 4 | 2026-08-05/06 | Agent brand polish: branded greeting (tone) + logo/favicon/header/login/sidebar (visual) | completed |
| 5 | 2026-08-06 | Three live-reported bugs: `/mis-citas` phone formatting + normalization, tool-loop hang fix (chat could dead-end silently) | completed |
| 6 | 2026-08-06 | Single-tap selection everywhere, incl. inline mid-conversation in the free-text AI chat (`offer_service_selection` tool, DEC-13) | completed |
| 7 | 2026-08-06 | Specialist name-variant resolution ("Yez"/"Yetzebell"/"Yetze") + date-hallucination fix (DEC-14) | completed |
| 8 | 2026-08-06 | Deterministic backend safety net forcing the inline picker on every conversation's first reply — prompt-following alone (iteration #6) wasn't reliable enough | completed |
| 9 | 2026-08-06 | Small copy polish — headings above the categoría/servicio picker steps | completed |
| 10 | 2026-08-06 | Fixed over-eager escalation to a human for services that don't actually need one (system prompt + the escalate tool's own description) | completed |
| 11 | 2026-08-06/07 | SSE auto-reconnect bug fixes in the chat stream; identified (not fixed — doesn't affect production) a Vite-dev-proxy-only limitation | completed |
| 12 | 2026-08-07 | Booking picker steps now stay visible as a running history (summary rows) instead of replacing themselves | completed |
| 13 | 2026-08-07 | Google Sheets live sync (fire-and-forget, new Level-3 credentials) + email field + input formatting/placeholders on the contact step | completed, not yet activated (needs client's Google Cloud credentials) |
| 14 | 2026-08-07 | Found and fixed the real root cause of "necesito refrescar para ver la respuesta" — a silently-dropped SSE reply when no `delta` preceded `done`; added a polling safety net | completed |
| 15 | 2026-08-07 | Admin "Citas"/"Servicios" pages could get stuck on "Cargando…" forever on a failed fetch (no `isError` UI branch) — added error + "Reintentar" to match the pattern already used in Dashboard | completed — real root cause turned out to be #18 (expired JWT), this fix stands on its own too |
| 16 | 2026-08-07 | Deployment prep: `git init` + first commit, reviewed Docker/EasyPanel config, generated production secrets | completed |
| 17 | 2026-08-08 | EasyPanel deployment: repo pushed (public), `oopss-postgres`+`oopss-app` services created in `criteriabravo` project, env vars given, first build not yet run | in_progress — see project_memory.md's 🔴 EXACT RESUME POINT |
| 18 | 2026-08-08 | Found and fixed the true root cause of recurring "admin no funciona" reports (#14-#17): expired 24h JWT with no client-side 401 handling — `apiClient.ts` now clears the token and redirects to login on 401 | completed |
| 19 | 2026-08-08 | Added missing "Peinado" service; `offer_service_selection` gained an optional `categories` param so "uñas" narrows straight to Manos+Pies; caught+fixed a service-name-hallucination regression in the same pass | completed |
| 20 | 2026-08-08 | Admin appointment-edit modal: fixed unreadable Estado dropdown (+ 8 identical selects elsewhere), added a real one-click "Cancelar cita" action (old "Cancelar" was just the dismiss button) | completed |
| 21 | 2026-08-08 | Admin "Reagendar": can now change specialist (not just date/time) — `rescheduleAppointment()` gained an optional specialist param, new single-tap especialista→hora sub-flow in the edit modal | completed |
| 22 | 2026-08-09 | `get_service_info` couldn't find a real service if the client's phrasing had an extra word or missing accent (e.g. "extension en polygel" → "Extensión Polygel") — rewrote matching to be word-based, accent/case-insensitive | completed |
| 23 | 2026-08-09 | Confirming a Q&A-clarified service ("si creemos cita") now jumps to the visual especialista→fecha→hora→datos selector instead of asking for those details in text — `offer_service_selection` gained a `serviceName` param, `ServiceBookingFlow` gained `initialServiceId` | completed |
| 24 | 2026-08-09 | Naming a service + asking to book in one message ("agendar mani spa") showed the generic picker instead of that service (model guessed a fake name instead of calling get_service_info first) — fixed; added a requested "¿Quieres agendar X? Sí/No" confirm-first safety net for uncertain matches | completed |
| 25 | 2026-08-09 | #24 still failed intermittently on cross-turn confirmation ("si agendemos") — root cause was history dropping tool-call context between turns; fixed deterministically with a "confirmed services" list re-derived from stored toolCallMeta and injected fresh every turn | completed |
| 26 | 2026-08-09 | "Que servicios ofrecen?" sometimes showed picker-inviting text with no buttons (unreproducible live, intermittent LLM miss) — strengthened `withServiceSelectionFallback()` with a 4th trigger matching the app's own standard "elige el que prefieras" phrasing | completed (defense-in-depth; original failure not directly reproduced) |
| 27 | 2026-08-09 | Worse variant of #26: confirming a service got the numbered-list "mal ejemplo" text with no picker — added a 5th targeted fallback trigger that recovers the correct service by matching a bolded name against already-validated services from the conversation | completed |
| 28 | 2026-08-10 | Sixth variant: "quiero hacerme las uñas" got "Elige entre Manos o Pies" prose with no buttons (matched neither the "prefieras" nor "qué servicio" triggers) — added a 6th trigger, and generalized the fallback so any trigger now narrows to real category names mentioned in the reply instead of always showing all 10 | completed (defense-in-depth; original failure not directly reproduced) |
| 29 | 2026-08-10 | Contact form (nombre/teléfono/correo) never appeared after especialista/fecha/hora — NOT an AI tool-calling miss this time; the widget rendered correctly but off-screen because the chat only auto-scrolls on new messages, not on the booking widget's internal step changes. Fixed by scrolling the widget itself into view on every step change | completed |

## Types

- `IT` — Infrastructure Task (foundational, no UI)
- `UJ` — User Journey (end-to-end user action)

## Status Values

- `pending` — not started
- `in_progress` — actively being implemented
- `completed` — finished and verified
- `blocked` — waiting on a dependency or decision
