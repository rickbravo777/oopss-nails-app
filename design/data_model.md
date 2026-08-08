# Data Model

## Entities

### Client

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| name | string | not null | |
| phone | string | not null, indexed | Clave de búsqueda para autoservicio (junto con `Appointment.confirmationCode`) |
| email | string | nullable | |
| createdAt | datetime | not null | |

### Specialist

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| name | string | not null | Yez, Tania, Mariangely, Aurora, Ana María, Sonia (seed inicial) |
| active | boolean | default true | |
| photoUrl | string | nullable | |
| bio | text | nullable | |
| createdAt | datetime | not null | |

### ServiceCategory

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| name | string | not null, unique | Manos, Pies, Cabello, Depilación Corporal, Epilación Facial, Cejas, Pestañas, Faciales y Bienestar, Servicios Corporales/Tratamientos, Depilación Láser |
| displayOrder | int | not null | |

### Service

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| categoryId | uuid | FK → ServiceCategory | |
| name | string | not null | Ej. "Manicure Gel", "Extensión Polygel" |
| description | text | nullable | |
| priceType | enum | `fixed` \| `starting_at` \| `range` | `range` cubre casos como "Diseños o Efectos $10/15" y "Epilación de Mentón $3–$6" |
| price | decimal | not null | Precio base o "desde" |
| priceMax | decimal | nullable | Solo usado con `priceType=range` |
| currency | string | default `USD` | Ver assumption A1 |
| requiresConsultation | boolean | default false | true para servicios "desde" de cabello (precio final lo confirma Aurora) |
| requiresPhoto | boolean | default false | true para servicios "desde" de cabello y diseños de uñas |
| defaultDurationMinutes | int | not null | Estimación editable — ver buckets abajo |
| sessionPackageSize | int | nullable | Para depilación láser: 6 (paquete de 6 sesiones) |
| active | boolean | default true | |
| sortOrder | int | not null | |

**Duraciones por defecto propuestas (estimaciones, editables por servicio y por especialista — assumption A4):**

| Categoría / tipo de servicio | Duración estimada |
|---|---|
| Servicios rápidos (epilación facial, cejas sin laminado, depilación puntual pequeña) | 15–30 min |
| Manicure/Pedicure regular, Mani/Pedi Spa | 45–60 min |
| Servicios de gel/extensión de uñas (Rubber Gel, Polygel, Acrílico) | 75–90 min |
| Pestañas (lifting, sets, volumen) | 60–120 min según técnica |
| Faciales y tratamientos corporales/bienestar | 45–60 min |
| Procesos de color de cabello (tinte, mechas, balayage, alisado) | 120–180 min |
| Cabello rápido (lavado, blower) | 30–45 min |
| Depilación láser (por sesión) | 20–30 min |

### SpecialistService (tabla intermedia)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| specialistId | uuid | FK → Specialist, PK compuesta | |
| serviceId | uuid | FK → Service, PK compuesta | |
| durationOverrideMinutes | int | nullable | Si un especialista es más rápido/lento que el default del servicio |

Restricción de negocio crítica: solo existe una fila aquí si el especialista realmente atiende ese servicio. Ej. Yez tiene exactamente 3 filas (Polygel, Rubber Gel, extensión Polygel). El backend rechaza cualquier intento de reserva que empareje un especialista con un servicio sin fila correspondiente, sin importar lo que decida el modelo de IA (mitiga R2 en `planning/risks.md`).

### ScheduleRule (horario semanal recurrente)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| specialistId | uuid | FK → Specialist | |
| dayOfWeek | int | 0–6 | |
| startTime | time | not null | |
| endTime | time | not null | |
| isActive | boolean | default true | |

Codifica, por ejemplo, el inicio de Ana María a las 11am, y el horario general lun-vie 9am–6:30pm / sáb 9am–4:30pm.

### ScheduleConstraint (regla flexible de "último horario reservable")

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| specialistId | uuid | FK → Specialist, nullable = aplica a todos | |
| serviceId | uuid | FK → Service, nullable = aplica a todos | |
| serviceCategoryId | uuid | FK → ServiceCategory, nullable = aplica a todos | |
| dayOfWeek | int | nullable = aplica a todos los días | |
| latestStartTime | time | not null | |
| note | string | nullable | |

Una sola entidad flexible expresa: corte de Yez entre semana 7pm/sábados 5pm, corte de Tania y Mariangely sábados 4pm, corte de Aurora en procesos largos 4:30pm vs. blower/lavados 6pm — todo editable por el admin sin cambios de código.

### ScheduleException (excepción puntual)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| specialistId | uuid | FK → Specialist | |
| date | date | not null | |
| type | enum | `day_off` \| `custom_hours` | |
| startTime | time | nullable | Solo si `custom_hours` |
| endTime | time | nullable | Solo si `custom_hours` |
| reason | string | nullable | |

### Appointment

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| clientId | uuid | FK → Client | |
| specialistId | uuid | FK → Specialist | |
| date | date | not null | |
| startTime | time | not null | |
| endTime | time | not null | Calculado a partir de la duración de los servicios incluidos |
| status | enum | `pending_confirmation` \| `confirmed` \| `cancelled` \| `completed` \| `no_show` | `pending_confirmation`: usado para citas de cabello "desde" en espera de evaluación de Aurora (assumption A6) |
| confirmationCode | string | unique, indexed | Código corto para autoservicio (junto con teléfono) |
| notes | text | nullable | |
| source | enum | `chat` \| `admin` | |
| createdAt | datetime | not null | |

### AppointmentService (líneas de la cita, soporta múltiples servicios)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| appointmentId | uuid | FK → Appointment | |
| serviceId | uuid | FK → Service | |
| order | int | not null | Orden dentro de la cita |
| durationMinutesSnapshot | int | not null | Congelado al momento de agendar |
| priceSnapshot | decimal | not null | Congelado al momento de agendar (ediciones futuras del catálogo no reescriben historial) |

### Conversation

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| clientId | uuid | FK → Client, nullable hasta que se identifique | |
| sessionToken | string | unique, indexed | |
| status | enum | `active` \| `handed_off` \| `closed` | |
| createdAt | datetime | not null | |
| lastMessageAt | datetime | not null | |

### Message

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| conversationId | uuid | FK → Conversation | |
| role | enum | `user` \| `assistant` \| `system` \| `human_agent` | |
| content | text | not null | |
| attachmentId | uuid | FK → PhotoUpload, nullable | |
| toolCallMeta | json | nullable | Auditoría de qué función del backend invocó el modelo — útil para depurar casos cercanos a alucinación |
| createdAt | datetime | not null | |

### PhotoUpload

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| conversationId | uuid | FK → Conversation, nullable | |
| appointmentId | uuid | FK → Appointment, nullable | |
| clientId | uuid | FK → Client, nullable | Nullable porque una foto puede subirse antes de que la clienta dé su nombre/teléfono (ver DEC-06 en `docs/decision_log.md`) |
| filePath | string | not null | Ruta dentro del volumen `/app/uploads`, nombre de archivo UUID |
| mimeType | string | not null | Validado en upload |
| sizeBytes | int | not null | Validado contra `MAX_UPLOAD_SIZE_MB` |
| purpose | enum | `nail_reference` \| `hair_desde_evaluation` | |
| createdAt | datetime | not null | |

### EscalationFlag

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| conversationId | uuid | FK → Conversation | |
| reason | enum | `facial_recommendation` \| `laser_zone_confirmation` \| `hair_desde_pricing` \| `ai_uncertain` \| `client_requested_human` | |
| status | enum | `open` \| `resolved` | |
| assignedSpecialistId | uuid | FK → Specialist, nullable | Ej. Sonia para faciales/láser, Aurora para precio de cabello |
| resolutionNotes | text | nullable | |
| createdAt | datetime | not null | |
| resolvedAt | datetime | nullable | |

### AdminUser

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| name | string | not null | |
| email | string | unique, not null | |
| passwordHash | string | not null | bcrypt |
| active | boolean | default true | |
| lastLoginAt | datetime | nullable | |

Un solo rol `admin` en v1 (sin complejidad multi-rol — control de alcance).

### Credential (vault genérico Nivel 3)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| key | string | unique | Ej. `OPENAI_API_KEY` |
| encryptedValue | text | not null | Cifrado con `ENCRYPTION_KEY` |
| updatedByAdminId | uuid | FK → AdminUser | |
| updatedAt | datetime | not null | |

### TermSynonym

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| term | string | not null | Ej. "pintura en gel", "esmalte semipermanente", "semipermanente" |
| canonicalServiceId | uuid | FK → Service, nullable | |
| canonicalCategoryId | uuid | FK → ServiceCategory, nullable | |
| notes | string | nullable | |

### AssistantPolicy

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| key | string | unique | Ej. `conversation_order_text`, `escalation_rules_text` |
| value | text | not null | Fragmento inyectado en el system prompt |
| updatedAt | datetime | not null | |

Deliberadamente un conjunto pequeño de fragmentos de texto editables, no un motor de reglas genérico (ver R7 en `planning/risks.md`).

### ErrorLog

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| source | string | not null | |
| message | text | not null | |
| createdAt | datetime | not null | |

Ligero, solo para el dashboard de salud — los logs del contenedor siguen siendo la fuente de verdad para depuración profunda.

## Relationships

- Client 1→N Appointment, 1→N Conversation
- Specialist N↔N Service (vía SpecialistService)
- Specialist 1→N ScheduleRule, 1→N ScheduleConstraint, 1→N ScheduleException, 1→N Appointment
- Appointment 1→N AppointmentService
- Conversation 1→N Message, 1→N EscalationFlag
- Message N→1 PhotoUpload (opcional)
- AdminUser 1→N Credential (vía `updatedByAdminId`)

## Indexes

- `Client.phone`: búsqueda de autoservicio de citas
- `Appointment.confirmationCode`: búsqueda de autoservicio (junto con teléfono)
- `Conversation.sessionToken`: continuidad de sesión de chat anónima
- `Appointment(specialistId, date, startTime)`: chequeo de conflictos/disponibilidad

(Populated during planning with /init-project)
