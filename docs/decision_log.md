# Decision Log

Architectural and design decisions with rationale. Created when decisions are made during planning or implementation.

## Format

### DEC-XX: [Decision Title]

- **Date**: [Date]
- **Context**: [What prompted this decision]
- **Decision**: [What was decided]
- **Rationale**: [Why this option was chosen]
- **Alternatives Considered**: [Other options and why they were rejected]

## Decisions

### DEC-01: Canal único de atención = chat web propio

- **Date**: 2026-08-03
- **Context**: El brief inicial dejaba abierto si el asistente operaría vía WhatsApp, Instagram, web propia, o varios canales a la vez.
- **Decision**: Solo chat web propio (PC y móvil vía navegador), sin WhatsApp Business API ni Instagram DM en v1.
- **Rationale**: Elimina la dependencia de aprobaciones de negocio de Meta, costos por mensaje, y complejidad de integración multi-canal, permitiendo entregar el flujo completo de agendamiento más rápido.
- **Alternatives Considered**: WhatsApp Business API (descartado por costo/complejidad de aprobación), Instagram DM (descartado por la misma razón), multi-canal simultáneo (descartado por alcance — se puede añadir como iteración futura).

### DEC-02: Calendario autocontenido, sin sincronización externa

- **Date**: 2026-08-03
- **Context**: El documento fuente pedía "integración con calendario/agenda en tiempo real por especialista", sin especificar si debía sincronizarse con un calendario externo ya en uso.
- **Decision**: Calendario propio construido dentro de la app (tablas `ScheduleRule`/`ScheduleConstraint`/`ScheduleException`/`Appointment`), sin sincronización de dos vías con Google Calendar u otro servicio.
- **Rationale**: Evita la complejidad de OAuth por especialista y manejo de conflictos de sincronización bidireccional; el salón no mencionó depender de un calendario externo compartido.
- **Alternatives Considered**: Sincronización con Google Calendar (descartada — mayor complejidad sin beneficio claro confirmado por el usuario).

### DEC-03: Sin integración de pagos/depósito en v1

- **Date**: 2026-08-03
- **Context**: El brief marcaba la política de depósito/anticipo como pendiente de confirmar con el cliente real del salón.
- **Decision**: La versión actual no incluye cobro de depósito ni integración de pasarela de pago (ej. Stripe). El agendamiento se confirma sin pago por adelantado.
- **Rationale**: Decisión explícita del usuario de no bloquear el desarrollo en una política de negocio aún no definida; se documenta como mejora futura.
- **Alternatives Considered**: Depósito fijo o por porcentaje (pospuesto), pago completo por adelantado (no evaluado, fuera de alcance actual).

### DEC-04: Duraciones de servicio estimadas por categoría

- **Date**: 2026-08-03
- **Context**: Ni el system prompt ni el catálogo de precios especifican cuánto dura cada servicio, información necesaria para bloquear el calendario correctamente.
- **Decision**: Se proponen buckets de duración por defecto por tipo de servicio (ver tabla en `design/data_model.md`), almacenados por servicio y con override opcional por especialista, editables desde el panel admin.
- **Rationale**: Permite construir el sistema de agendamiento sin bloquear el desarrollo a la espera de datos reales del salón; el modelo de datos soporta corrección posterior sin cambios de esquema.
- **Alternatives Considered**: Detener el desarrollo hasta recibir duraciones exactas del cliente (rechazado por el usuario, quien pidió estimaciones razonables).

### DEC-05: Stack — Node.js/Express/TypeScript + React/Vite + PostgreSQL/Prisma

- **Date**: 2026-08-03
- **Context**: El template no define stack; debía seleccionarse durante la planificación según los defaults de gobernanza (JWT+bcrypt, OpenAI SDK, Docker+EasyPanel) y el tamaño del proyecto (un solo salón, 6 especialistas).
- **Decision**: Backend Express+TypeScript, frontend React+TypeScript+Vite con Tailwind, PostgreSQL 16 vía Prisma, SSE para streaming de chat (sin Socket.io/Redis), almacenamiento de fotos en volumen local Docker.
- **Rationale**: Ver justificación completa por capa en `design/stack_selection.md` — prioriza simplicidad de despliegue de host único y bajo volumen de concurrencia sobre infraestructura de escala mayor.
- **Alternatives Considered**: NestJS, Next.js full-stack, Socket.io+Redis, almacenamiento S3 desde el día uno — todos descartados por sobre-ingeniería relativa al alcance (ver `design/stack_selection.md`).

### DEC-06: `PhotoUpload.clientId` pasa a ser opcional (desviación de `data_model.md`)

- **Date**: 2026-08-03
- **Context**: Al implementar IT-07 (subida de archivos), `design/data_model.md` especificaba `PhotoUpload.clientId` como FK obligatoria. Pero el flujo real (UJ-02/UJ-05) permite que la clienta suba una foto de referencia durante una conversación anónima, antes de dar su nombre y teléfono (eso solo ocurre al agendar, en UJ-07) — igual que `Conversation.clientId` ya es nullable por la misma razón.
- **Decision**: `PhotoUpload.clientId` se cambia a nullable (`String?`), consistente con `Conversation.clientId`. La foto queda asociada por `conversationId` mientras no haya `Client` identificado; se puede vincular al `Client` retroactivamente si se desea en una iteración futura, pero no es necesario para el flujo actual.
- **Rationale**: Evita bloquear la subida de fotos (un requisito explícito del proyecto) detrás de una identificación que en la práctica ocurre más tarde en la conversación. Cambio de una sola columna, sin impacto en otras entidades.
- **Alternatives Considered**: Crear un `Client` "placeholder" vacío al iniciar cada conversación para satisfacer la FK obligatoria — rechazado porque ensucia la tabla `Client` (usada como fuente real de nombre/teléfono) con filas vacías y complica la búsqueda por teléfono.

### DEC-07: Sesión de clienta = token opaco en BD, no JWT firmado con `CLIENT_SESSION_SECRET`

- **Date**: 2026-08-03
- **Context**: `design/architecture.md` documenta `CLIENT_SESSION_SECRET` como el secreto que firma los tokens de sesión anónimos de la clienta (separado del JWT admin). Al implementar IT-04, se optó en su lugar por un token aleatorio opaco (`crypto.randomBytes`) almacenado y consultado directamente en `Conversation.sessionToken` — `CLIENT_SESSION_SECRET` quedó definido en `config/env.ts` pero sin usarse. Encontrado durante el `/review` de M0 (ver `docs/work_log.md`).
- **Decision**: Mantener el token opaco en BD como mecanismo real de sesión de clienta. `CLIENT_SESSION_SECRET` se conserva en el schema de entorno como reservado para un futuro cambio a JWT sin estado si hiciera falta, pero no se usa activamente.
- **Rationale**: Un token opaco consultado en BD es igual de seguro para este caso de uso (sesión de chat, sin necesidad de validación sin estado en múltiples servicios) y más simple — no requiere lógica de firma/verificación aparte de la ya existente para JWT admin. Revertir esto no es más seguro, solo más complejo.
- **Alternatives Considered**: Implementar JWT firmado con `CLIENT_SESSION_SECRET` para las sesiones de clienta, igual que el JWT admin — descartado por no aportar beneficio real a este alcance (un solo backend, no hay necesidad de validar sesiones sin consultar la BD).

### DEC-08: Ampliación de alcance — autoservicio de reprogramar cita (no solo cancelar)

- **Date**: 2026-08-04
- **Context**: El plan original (UJ-09) solo cubría cancelar una cita desde `/mis-citas`. Durante la ejecución de M2, el usuario pidió explícitamente: "el cliente debe tener la posibilidad de poder agendar, cancelar, mover citas, etc." — una ampliación de alcance directa y explícita, no una adición especulativa.
- **Decision**: Se añadió reprogramar (`POST /appointments/:id/reschedule`, protegido por phone+code igual que cancelar) como parte de UJ-09, con su propia interfaz en `/mis-citas` (selector de fecha + búsqueda de horarios reales + selección). Requirió además `Client.phone` como campo único (para poder hacer `upsert` por teléfono al crear citas) y un índice único parcial en `Appointment` (`specialistId`, `date`, `startTime`) que excluye las citas canceladas, para prevenir doble reserva a nivel de base de datos.
- **Rationale**: Petición explícita y directa del usuario dentro del alcance natural de "gestionar mi cita" que ya cubría UJ-08/UJ-09; reutiliza toda la lógica de disponibilidad ya construida para UJ-06/UJ-07 (excluyendo la cita propia del chequeo de conflicto), sin necesidad de nueva infraestructura.
- **Alternatives Considered**: Dejarlo fuera de esta ronda y agendarlo como una iteración futura — descartado porque el usuario lo pidió en el momento, dentro del mismo flujo de trabajo, y el costo de construirlo ahora (reutilizando `checkAvailability`) era bajo.

### DEC-09: M3 — endpoints GET de listado añadidos al contrato; soft-delete y reemplazo completo como patrón estándar

- **Date**: 2026-08-04
- **Context**: Al implementar UJ-13/UJ-14/UJ-15 (gestión de servicios, personal y horarios), `design/api_contracts.md` solo documentaba POST/PUT/DELETE para `/admin/services` y `/admin/specialists`, sin GET de listado ni de detalle — pero las pantallas de administración no pueden funcionar sin poder listar y cargar un registro para editarlo. Además, `Service` y `Specialist` están referenciados por historial de citas (`AppointmentService`/`Appointment`) vía FK, por lo que un DELETE real (hard delete) fallaría o corrompería ese historial.
- **Decision**: (1) Se añadieron `GET /admin/services`, `GET /admin/specialists`, `GET /admin/specialists/:id` al contrato — el GET de servicios/especialistas admin incluye inactivos, a diferencia de las rutas públicas equivalentes. (2) `DELETE` en ambos recursos es un soft delete (`active=false`), nunca una fila eliminada. (3) `PUT /admin/specialists/:id/services` y `PUT /admin/specialists/:id/schedule` reemplazan el set completo (servicios asignados; reglas+restricciones de horario) en vez de aceptar un diff parcial — la UI siempre envía el conjunto completo que está mostrando, así que un reemplazo no puede dejar silenciosamente una fila obsoleta que un PATCH parcial sí podría. (4) `GET /admin/specialists/:id/schedule` también devuelve `exceptions` de solo lectura (gestionadas por separado vía sus propios endpoints POST/DELETE) para evitar una segunda llamada desde la pantalla de horario.
- **Rationale**: Son adiciones necesarias para que las pantallas construidas en M3 funcionen — no se documentaron de antemano porque `api_contracts.md` fue escrito antes de implementar el detalle de las pantallas admin. `api_contracts.md` ya fue actualizado para reflejar el estado real, siguiendo el mismo criterio que DEC-07 (documentar cualquier desviación entre el contrato original y lo realmente construido).
- **Alternatives Considered**: PATCH parcial para servicios/horario (rechazado — más flexible pero abre la puerta a que la UI olvide enviar una desasignación, justo el bug que UJ-14 pide evitar explícitamente); hard delete con verificación de "sin citas asociadas" antes de permitirlo (rechazado por complejidad innecesaria frente al soft-delete, que ya es el patrón que `Service.active` usaba desde antes de M3).

### DEC-10: M4 — `DELETE` de políticas añadido al contrato; `EscalationFlag.resolutionNotes` es un solo campo reutilizado

- **Date**: 2026-08-04
- **Context**: Al implementar UJ-18 (base de conocimiento), `design/api_contracts.md` solo documentaba `GET /admin/knowledge-base/policies` y `PUT /admin/knowledge-base/policies/:key` — sin forma de eliminar un fragmento de política ya creado. Por separado, al implementar UJ-19 (cola de escalamientos), se identificó que `EscalationFlag.resolutionNotes` ya se usaba desde M2 (`escalateToHuman.ts`) para guardar la nota de contexto que el asistente adjunta al escalar (ej. "Duda de piel sensible") — el mismo campo que `PUT /admin/escalations/:id/resolve` ahora usa para la nota de resolución del admin. El esquema solo tiene una columna `resolutionNotes`, no dos.
- **Decision**: (1) Se añadió `DELETE /admin/knowledge-base/policies/:key` — "editar la base de conocimiento" (UJ-18) incluye poder quitar un fragmento que ya no aplica, no solo crear/actualizar. (2) Se deja `resolutionNotes` como un solo campo compartido: al resolver un escalamiento, la nota de resolución del admin **sobrescribe** la nota de contexto original de la IA. No se creó una columna nueva ni una migración para separar ambos usos.
- **Rationale**: El `DELETE` de políticas es una adición pequeña y evidente, del mismo tipo que las de DEC-09. Para `resolutionNotes`: la nota original de la IA ya es visible en el admin panel *antes* de resolver (se muestra en la tarjeta del escalamiento en estado "Abierto"), así que no se pierde silenciosamente — el admin la ve, actúa en consecuencia, y su propia nota de resolución es lo que queda registrado para el historial. Agregar una columna nueva (ej. `contextNote` separada de `resolutionNotes`) es un cambio de schema no solicitado por ninguna UJ ni por el usuario, y el impacto real de perder la nota original tras resolver es bajo (el caso ya fue atendido).
- **Alternatives Considered**: Migrar el schema para separar `contextNote` (escrito por la IA al escalar) de `resolutionNotes` (escrito por el admin al resolver) — descartado por ahora como fuera de alcance de M4; queda anotado aquí como algo a reconsiderar si en la práctica se necesita conservar el historial completo de un escalamiento después de resuelto.

### DEC-11: Texto de `AssistantPolicy` sin sanitización de prompt-injection — riesgo aceptado

- **Date**: 2026-08-04
- **Context**: El `/review` de `{M3+M4}` señaló que `AssistantPolicy.value` (los fragmentos de texto libre que el admin edita en UJ-18 y que `buildSystemPrompt()` inyecta directamente en el prompt del sistema del asistente) solo tiene un límite de longitud (`z.string().max(2000)`), sin ninguna sanitización de contenido — a pesar de que la descripción de seguridad de UJ-18 en `implementation/user_journeys.md` menciona ambos.
- **Decision**: Se deja el campo sin sanitización adicional por ahora. La validación es solo de longitud.
- **Rationale**: El "prompt-injection" real que importaría mitigar es contenido de un actor no confiable (una clienta) llegando al prompt del sistema — eso ya no ocurre aquí: `AssistantPolicy.value` solo lo puede escribir un admin autenticado (`requireAdminAuth` en toda la subruta `/admin`), que ya tiene control total sobre datos mucho más sensibles del sistema (precios, credenciales, horarios). El modelo de amenaza de este proyecto (single-admin, sin roles intermedios) ya acepta ese nivel de confianza en cualquier admin autenticado en varios otros puntos (ver IT-09's Security Check). Agregar sanitización de contenido aquí sin un vector de ataque real correspondiente sería alcance no solicitado.
- **Alternatives Considered**: Sanitizar/limitar el texto de política (ej. rechazar ciertos patrones, o escapar delimitadores usados internamente en el prompt) — pospuesto como mejora de defensa en profundidad a considerar antes de una entrega final, especialmente si en el futuro se agregan roles de admin con menos privilegios que no deberían poder alterar el comportamiento del asistente libremente.

### DEC-12: Paleta de colores reemplazada por la paleta real de marca (post-entrega)

- **Date**: 2026-08-04
- **Context**: La paleta original (`design/style_guide.md`, rosa/malva) fue una elección de planeación sin activos de marca reales disponibles en ese momento. Tras la entrega, el usuario pidió cambiar los tonos de fondo y usar la paleta real de la marca, señalando el catálogo `Nuestros servicios Oopss Nails.pdf` como fuente. Ese PDF tiene una portada y encabezados de categoría con identidad visual consistente (fondo crema, texto/acentos en taupe, formas decorativas en tonos tostados) — se renderizaron las páginas con PyMuPDF y se extrajeron los colores dominantes por muestreo de píxeles (no a ojo).
- **Decision**: Se reemplazó la paleta completa en `frontend/src/index.css`: modo claro usa los valores exactos muestreados (`#F7F2F0` fondo, `#917E72` primario, `#C2AB9D`/`#E6DED9` acentos/decorativos). Modo oscuro se mantuvo (el usuario pidió conservar el toggle) pero se retonalizó a la misma familia cálida taupe/tostado en vez de los rosa/malva anteriores, sobre el mismo fondo café oscuro que ya existía. Colores semánticos (éxito/advertencia/error) se ajustaron a tonos más terrosos (verde salvia, ámbar, terracota) para no romper la armonía con el resto de la paleta.
- **Rationale**: El usuario pidió explícitamente usar la paleta real de la marca en vez de la inventada durante planeación; extraer los valores por muestreo de píxeles del material de marca real (no aproximar a ojo) asegura que los colores sean exactos, no una interpretación.
- **Alternatives Considered**: Pedir al usuario que envíe el logo en vector/alta resolución antes de tocar el código — se ofreció como alternativa pero el usuario señaló directamente el PDF como fuente, y ese documento ya tiene suficiente consistencia visual (misma paleta en portada y en cada página de categoría) para extraer una paleta confiable sin bloquear el trabajo. Si más adelante llega un logo oficial con colores ligeramente distintos, se puede refinar sin gran esfuerzo (son 3-4 variables CSS).

### DEC-13: Las llamadas a herramientas de la IA pueden disparar UI en el frontend, no solo traer datos (post-entrega)

- **Date**: 2026-08-06
- **Context**: El usuario pidió que la selección por clics (categoría → servicio → especialista, ya construida como flujo independiente de la IA) también estuviera disponible **dentro** de la conversación de texto libre — es decir, que cuando la clienta escribe algo como "quiero una cita" sin especificar el servicio, la IA le muestre el mismo selector visual en vez de preguntarle en texto. Hasta ahora, las herramientas de la IA (`get_service_info`, `check_availability`, `create_appointment`) solo existían para que el modelo consultara/mutara datos reales — ninguna existía para comunicarle algo al frontend sobre qué renderizar.
- **Decision**: Se añadió `offer_service_selection`, una herramienta "de señal" sin efecto real en el backend (el handler solo devuelve `{ shown: true }`) — su único propósito es aparecer en el `toolCallMeta` del mensaje del asistente (ya se guardaba en la base de datos desde el inicio del proyecto, pero nunca se devolvía al cliente). Se extendió `GET /chat/sessions/:id/messages` y el evento SSE `"done"` para incluir `toolCallMeta`, y el frontend (`ChatPage.tsx`) ahora revisa cada mensaje del asistente: si su `toolCallMeta` incluye una llamada a `offer_service_selection`, renderiza el componente `ServiceBookingFlow` justo debajo de ese mensaje.
- **Rationale**: Reutilizar el flujo de selección por clics ya construido (en vez de duplicar su lógica dentro del prompt/respuestas de la IA) mantiene el principio central del proyecto — la parte mecánica de agendar nunca pasa por el modelo, solo por endpoints reales y ya probados. Extender el sistema de herramientas para que una herramienta pueda ser "solo una señal para el frontend" es un patrón nuevo pero mínimo: no requiere tocar el modelo de datos, no crea superficie de autenticación nueva, y es coherente con cómo ya funcionaba `toolCallMeta` (solo faltaba exponerlo).
- **Alternatives Considered**: Detectar la intención de agendar en el frontend con heurísticas de texto (ej. buscar palabras como "cita", "agendar") en vez de dejar que el modelo decida — descartado porque el modelo ya tiene mejor contexto conversacional que una heurística de palabras clave, y el proyecto ya delega estas decisiones de intención al modelo en otros puntos (ej. cuándo escalar a un humano). Añadir el selector como parte del texto de la respuesta (ej. un formato especial embebido en `content` que el frontend parsee) — descartado por ser más frágil (depende de que el modelo genere el formato exacto) frente a una llamada de función real, que el SDK de OpenAI ya valida estructuralmente.

### DEC-14: La fecha de "hoy" se inyecta en el prompt en cada llamada — nunca se cachea (post-entrega)

- **Date**: 2026-08-06
- **Context**: Verificando en vivo la resolución de nombres de especialistas (DEC-13 relacionado), se encontró que el modelo no tenía ninguna referencia a la fecha real de "hoy" — al pedirle disponibilidad sin que la clienta diera una fecha explícita, o usando un término relativo como "mañana", el modelo inventaba una fecha arbitraria (en una prueba, una fecha ya pasada respecto al día real de la conversación). `buildSystemPrompt()` nunca incluía la fecha actual en ninguna parte del prompt.
- **Decision**: `buildSystemPrompt()` ahora antepone una línea `FECHA DE HOY: <YYYY-MM-DD> (<día de la semana en español>)`, calculada con `new Date()` en cada llamada (la función ya se ejecuta sin caché en cada mensaje, así que esto no requiere invalidación adicional). Se añadió también una regla "FECHA — REGLA ESTRICTA" que instruye al modelo a preguntar por la fecha preferida en vez de asumir una, y a usar la fecha inyectada como única fuente de verdad para términos relativos.
- **Rationale**: Este es exactamente el tipo de alucinación que la arquitectura del proyecto busca prevenir (inventar un parámetro de búsqueda es tan problemático como inventar la respuesta) — no se trata de una preferencia de estilo sino de un hueco real en el prompt desde M1, que nunca se había manifestado en pruebas anteriores porque el flujo por clics calcula las fechas en el frontend (sin pasar por el modelo) y las pruebas previas del chat libre siempre incluían una fecha explícita escrita por quien probaba.
- **Alternatives Considered**: Ninguna considerada seriamente — inyectar la fecha actual en el prompt de un asistente conversacional es una práctica estándar y de bajo riesgo; no había una alternativa razonable a evaluar.
