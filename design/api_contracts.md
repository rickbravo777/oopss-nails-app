# API Contracts

## Base URL

`/api/v1`

## Authentication

- **Admin routes**: JWT bearer token (`Authorization: Bearer <token>`), obtenido vía `/auth/login`. Verificado por middleware en toda ruta bajo `/admin/*`.
- **Chat/cliente**: `sessionToken` anónimo (emitido por `POST /chat/sessions`), enviado como header `X-Session-Token` o cookie. No requiere contraseña.
- **Autoservicio de citas**: sin token — se valida con `phone` + `confirmationCode` en cada request (ver assumption A5).

## Endpoints

### Auth

#### POST /auth/login
- **Auth**: Public
- **Request**: `{ email, password }`
- **Response 200**: `{ token, admin: { id, name, email } }`
- **Errors**: 401 credenciales inválidas

#### GET /auth/me
- **Auth**: Required (admin)
- **Response 200**: `{ id, name, email }`

### Chat / Assistant

#### POST /chat/sessions
- **Auth**: Public
- **Request**: `{}` (opcionalmente `{ resumeToken }` para retomar sesión previa)
- **Response 200**: `{ sessionToken, conversationId }`

#### POST /chat/sessions/:id/messages
- **Auth**: Session token
- **Request**: `{ content, attachmentId? }`
- **Response 200**: `{ messageId, status: "processing" }` — la respuesta real llega por el stream SSE
- **Errors**: 404 sesión no encontrada, 400 contenido vacío

#### GET /chat/sessions/:id/stream
- **Auth**: Session token
- **Response**: SSE stream de tokens de la respuesta del asistente, más eventos de `tool_call` (para auditoría) y `done`

#### GET /chat/sessions/:id/messages
- **Auth**: Session token
- **Response 200**: `{ messages: [{ id, role, content, attachmentUrl?, createdAt }] }`

#### POST /chat/sessions/:id/escalate
- **Auth**: Session token
- **Request**: `{ reason }`
- **Response 200**: `{ escalationId, status: "open" }`

### Services / Catalog

#### GET /services
- **Auth**: Public
- **Request**: query params `category?`, `active=true` (default)
- **Response 200**: `{ services: [{ id, categoryId, categoryName, name, priceType, price, priceMax, currency, requiresConsultation, requiresPhoto, defaultDurationMinutes }] }`

#### GET /services/:id
- **Auth**: Public
- **Response 200**: detalle del servicio, incluyendo especialistas que lo atienden (`specialists: [{ id, name }]`)

#### GET /admin/services · POST /admin/services · PUT /admin/services/:id · DELETE /admin/services/:id
- **Auth**: Required (admin)
- **GET**: a diferencia de `GET /services` (público), incluye servicios inactivos — necesario para que la tabla de administración pueda mostrarlos y reactivarlos (añadido en UJ-13, no estaba en el contrato original)
- **Request** (POST/PUT): campos de `Service` (ver `design/data_model.md`)
- **DELETE**: soft delete (`active=false`), nunca borra la fila — `Service` está referenciado por `AppointmentService` histórico
- **Errors**: 400 validación (precio negativo, priceType/priceMax inconsistente), 409 nombre duplicado

#### GET /admin/service-categories · POST /admin/service-categories · PUT /admin/service-categories/:id
- **Auth**: Required (admin)

### Staff / Specialists

#### GET /specialists · GET /specialists/:id
- **Auth**: Public
- **Response 200**: `{ specialists: [{ id, name, photoUrl, active }] }` / detalle + `services: [{ id, name }]` que atiende
- **Estado**: aún no implementado — ninguna UJ construida hasta ahora (M0–M3) lo necesita; UJ-04 se resuelve vía el tool `get_service_info` del chat, no una ruta pública dedicada. Implementar si una futura UJ lo requiere.

#### GET /admin/specialists · GET /admin/specialists/:id · POST /admin/specialists · PUT /admin/specialists/:id · DELETE /admin/specialists/:id
- **Auth**: Required (admin)
- **GET** (lista y detalle): añadidos en UJ-14, no estaban en el contrato original — necesarios para que la pantalla de gestión pueda listar y cargar un especialista para editar
- **DELETE**: soft delete (`active=false`), mismo motivo que en servicios

#### PUT /admin/specialists/:id/services
- **Auth**: Required (admin)
- **Request**: `{ serviceIds: [uuid], durationOverrides?: { serviceId: minutes } }` — reemplaza el set completo de `SpecialistService` para ese especialista

#### GET /admin/specialists/:id/schedule · PUT /admin/specialists/:id/schedule
- **Auth**: Required (admin)
- **Request/Response** (PUT): `{ rules: [ScheduleRule], constraints: [ScheduleConstraint] }`
- **Response** (GET): igual, más `exceptions: [ScheduleException]` (añadido en UJ-15 como conveniencia de solo lectura, para que la pantalla de horario no necesite una segunda llamada — las excepciones se siguen gestionando por separado vía los endpoints de abajo)

#### POST /admin/specialists/:id/schedule-exceptions · DELETE /admin/specialists/:id/schedule-exceptions/:exceptionId
- **Auth**: Required (admin)

### Availability

#### POST /availability/check
- **Auth**: Public (usado por el asistente vía tool-call, y por la UI directamente)
- **Request**: `{ serviceIds: [uuid], specialistId?, dateFrom, dateTo }`
- **Response 200**: `{ slots: [{ specialistId, specialistName, date, startTime, endTime }] }` — solo especialistas habilitados para TODOS los servicios solicitados (join `SpecialistService`), respetando `ScheduleRule`/`ScheduleConstraint`/`ScheduleException` y citas ya existentes

### Appointments

#### POST /appointments
- **Auth**: Session token (desde chat) o admin
- **Request**: `{ clientName, clientPhone, clientEmail?, specialistId, date, startTime, services: [serviceId], notes? }`
- **Response 200**: `{ appointmentId, confirmationCode, status }`
- **Errors**: 409 conflicto de horario (revalidado transaccionalmente contra `Appointment` + reglas de horario en el momento de creación, no confiando en el chequeo previo de `/availability/check`), 422 combinación especialista-servicio inválida

#### GET /appointments/lookup?phone&code
- **Auth**: Public (validado por phone+code, no requiere sessionToken)
- **Response 200**: detalle de la cita

#### POST /appointments/:id/cancel
- **Auth**: Public (validado por phone+code en el body) o admin
- **Request**: `{ phone, confirmationCode }` (omitido si es admin)

#### GET /admin/appointments
- **Auth**: Required (admin)
- **Request**: query params `date?`, `specialistId?`, `status?`, y `dateFrom?`+`dateTo?` (rango, deben ir juntos) — el rango se añadió para alimentar la vista de calendario (semana/día) sin tener que pedir día por día

#### PUT /admin/appointments/:id
- **Auth**: Required (admin)

### Photo Upload

#### POST /uploads
- **Auth**: Session token o admin
- **Request**: multipart/form-data, campo `file` + `purpose`
- **Response 200**: `{ id, filePath }`
- **Errors**: 400 tipo MIME no permitido o tamaño excede `MAX_UPLOAD_SIZE_MB`

#### GET /uploads/:id
- **Auth**: Required (session token dueño del recurso, o admin)
- **Response**: stream del archivo

### Admin Dashboard / Credentials / Knowledge Base / Escalations

#### GET /admin/dashboard/health
- **Auth**: Required (admin)
- **Response 200**: `{ db: "ok"|"error", openai: "ok"|"error", diskUsagePercent, openEscalationsCount, recentErrors: [ErrorLog] }`

#### GET /admin/credentials · PUT /admin/credentials/:key
- **Auth**: Required (admin)
- **Response (GET)**: lista de claves con valor enmascarado (ej. `sk-...abcd`), nunca el valor completo
- **Request (PUT)**: `{ value }` — se cifra antes de persistir

#### GET /admin/knowledge-base/synonyms · POST /admin/knowledge-base/synonyms · DELETE /admin/knowledge-base/synonyms/:id
- **Auth**: Required (admin)

#### GET /admin/knowledge-base/policies · PUT /admin/knowledge-base/policies/:key · DELETE /admin/knowledge-base/policies/:key
- **Auth**: Required (admin)
- **DELETE**: añadido en UJ-18, no estaba en el contrato original — "editar" la base de conocimiento incluye poder quitar un fragmento de política ya no vigente, no solo crear/actualizar (ver DEC-10)

#### GET /admin/escalations · PUT /admin/escalations/:id/resolve
- **Auth**: Required (admin)
- **Request (GET)**: query param `status?` (`open` | `resolved`)
- **Request (resolve)**: `{ resolutionNotes }` — nota: `EscalationFlag.resolutionNotes` es el mismo campo que ya contiene la nota de contexto que la IA adjunta al escalar (`escalate_to_human`); resolver sobrescribe ese valor con la nota del admin (ver DEC-10)

#### GET /admin/conversations/:id
- **Auth**: Required (admin)
- **Response 200**: `{ id, status, client: {name, phone} | null, messages: [{id, role, content, createdAt}] }` — transcripción completa de la conversación, en orden cronológico
- **Estado**: añadido post-revisión de `{M3+M4}` (2026-08-04) — `design/ui_wireframes.md`'s "Admin — Escalamientos" ya especificaba "enlace a la conversación original" / acción "Ver conversación", y `implementation/user_journeys.md`'s UJ-19 lo listaba en su línea de Frontend, pero no existía ningún endpoint admin para leer los mensajes de una conversación (las rutas de `chat.ts` solo aceptan el session token de la propia clienta). No estaba en el contrato original; se añade aquí siguiendo el mismo criterio que DEC-09/DEC-10.

(Populated during planning with /init-project)
