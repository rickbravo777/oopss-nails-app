# Infrastructure Tasks & User Journeys

## Purpose

This file defines all work units for the project. Infrastructure Tasks (IT) are foundational work done first. User Journeys (UJ) are complete end-to-end user actions — the primary unit of implementation.

## Infrastructure Task Format

### IT-XX: [Task Name]

- **Purpose**: Why this is needed
- **Components**: What gets built
- **Acceptance Criteria**: How to verify it works
- **Security**: Relevant security considerations

## User Journey Format

### UJ-XX: [Journey Name]

- **Description**: What the user can do
- **Backend**: Models, API endpoints, services needed
- **Frontend**: Pages, components, navigation links needed
- **Acceptance Criteria**: How to verify the journey works end-to-end
- **Security**: Auth/authz requirements, input validation
- **Tests**: What automated tests are needed (if applicable)

## Tasks & Journeys

### IT-01: Repo & stack scaffolding

- **Purpose**: Establecer el esqueleto de backend y frontend antes de construir cualquier feature.
- **Components**: Express+TS skeleton (`backend/`), Vite+React+TS skeleton (`frontend/`), configuración de lint/format compartida.
- **Acceptance Criteria**: `npm run dev` levanta ambos servidores localmente; lint pasa sin errores.
- **Security**: N/A (scaffolding).

### IT-02: Database schema & migrations

- **Purpose**: Persistir todas las entidades definidas en `design/data_model.md`.
- **Components**: Prisma schema completo (Client, Specialist, ServiceCategory, Service, SpecialistService, ScheduleRule, ScheduleConstraint, ScheduleException, Appointment, AppointmentService, Conversation, Message, PhotoUpload, EscalationFlag, AdminUser, Credential, TermSynonym, AssistantPolicy, ErrorLog), migración inicial, esqueleto de seed script.
- **Acceptance Criteria**: `prisma migrate dev` corre limpio; seed script crea datos mínimos de prueba.
- **Security**: Constraints de integridad referencial; ningún campo de credencial en texto plano fuera de la tabla `Credential` (que se cifra en IT-06).

### IT-03: Admin auth system

- **Purpose**: Único rol autenticado del sistema.
- **Components**: JWT+bcrypt, `POST /auth/login`, `GET /auth/me`, middleware de verificación de token, guard de rutas `/admin/*`.
- **Acceptance Criteria**: Login con credenciales válidas devuelve token; rutas admin rechazan requests sin token válido (401).
- **Security**: bcrypt cost factor adecuado, JWT con expiración (`JWT_EXPIRATION`), sin filtrar el hash de contraseña en ninguna respuesta.

### IT-04: Client identification mechanism

- **Purpose**: Permitir continuidad de conversación y autoservicio de citas sin cuenta de clienta.
- **Components**: Emisión de `sessionToken` anónimo (`POST /chat/sessions`), lookup por `phone`+`confirmationCode` para `/appointments/lookup` y `/appointments/:id/cancel`.
- **Acceptance Criteria**: Una sesión de chat persiste entre recargas de página; una cita puede consultarse solo con el par correcto de teléfono+código.
- **Security**: Rate-limit sobre lookup/cancel para evitar enumeración de códigos.

### IT-05: OpenAI SDK integration wrapper

- **Purpose**: Motor conversacional abstraído por proveedor, con tool-calling como mecanismo anti-alucinación.
- **Components**: Interfaz `AIProvider` (`getChatCompletion`, `streamChatCompletion`), definición de tools (`check_availability`, `get_service_info`, `create_booking_draft`, etc.), plomería de streaming SSE.
- **Acceptance Criteria**: Una conversación de prueba con una pregunta de precio invoca `get_service_info` en vez de responder de memoria (verificable en `Message.toolCallMeta`).
- **Security**: La API key nunca se expone al frontend; se lee desde el vault de credenciales (IT-06), no del `.env` en runtime de request.

### IT-06: Credential vault

- **Purpose**: Permitir que el dueño del salón rote la API key de OpenAI sin depender de un desarrollador.
- **Components**: Servicio de cifrado/descifrado (`ENCRYPTION_KEY`), CRUD backend para tabla `Credential`.
- **Acceptance Criteria**: Guardar una credencial la persiste cifrada; la lectura vía API siempre devuelve el valor enmascarado, nunca el valor completo.
- **Security**: `ENCRYPTION_KEY` nunca sale del backend; ninguna ruta expone `encryptedValue` sin desenmascarar solo lo necesario para uso interno.

### IT-07: File upload handling

- **Purpose**: Soportar fotos de referencia de uñas y cabello.
- **Components**: Almacenamiento en volumen local (`UPLOADS_DIR`), validación de mime/tamaño, ruta autenticada de recuperación.
- **Acceptance Criteria**: Subir un archivo válido lo persiste con nombre UUID; un archivo de tipo/tamaño inválido es rechazado con 400.
- **Security**: Sin listado público de directorio; validación de mime real (no solo extensión); límite de tamaño (`MAX_UPLOAD_SIZE_MB`).

### IT-08: Docker & EasyPanel deployment config

- **Purpose**: Despliegue reproducible en EasyPanel.
- **Components**: Dockerfiles de backend/frontend, `docker-compose.yml` final (app + db + volúmenes nombrados), `.env.example` final, endpoint de health-check.
- **Acceptance Criteria**: `docker compose up` levanta el sistema completo localmente desde cero.
- **Security**: Ningún secreto committeado; `.env` real fuera de git (ya cubierto por `.gitignore`).

### IT-09: Admin panel shell

- **Purpose**: Base de navegación y tema para todas las pantallas admin.
- **Components**: Routing `/admin/*`, guard de auth en frontend, layout con sidebar, componentes base de tema glassmorphism light/dark.
- **Acceptance Criteria**: Navegar a `/admin` sin sesión redirige a `/admin/login`; con sesión, el sidebar navega entre las secciones definidas en `design/ui_wireframes.md`.
- **Security**: Guard de frontend es solo UX — la autorización real vive en el backend (IT-03).

### IT-10: Health/observability primitives

- **Purpose**: Visibilidad operativa del sistema para el admin.
- **Components**: `GET /admin/dashboard/health` (DB, OpenAI, disco), middleware ligero de captura de `ErrorLog`.
- **Acceptance Criteria**: El endpoint refleja `db: "error"` si la conexión falla (probar apagando la DB en dev).
- **Security**: Endpoint requiere auth admin; no expone detalles internos sensibles (stack traces) en la respuesta pública.

---

## M1: Client Chat & Discovery

### UJ-01: Browse services/prices via chat

- **Description**: La clienta pregunta sobre servicios y precios y recibe respuestas basadas en el catálogo real.
- **Backend**: `GET /services`, tool `get_service_info` conectado al catálogo real.
- **Frontend**: Pantalla de chat (`/`), renderizado de respuestas del asistente.
- **Acceptance Criteria**: Preguntar "¿cuánto cuesta el Balayage?" devuelve el precio real ("Desde $120"), nunca un valor inventado.
- **Security**: Ninguna entrada de usuario se interpola directamente en queries (uso de Prisma parametrizado).
- **Tests**: Test de integración simulando la tool call con un precio conocido del catálogo.

### UJ-02: Identify exact service via guided questions + term-equivalence

- **Description**: Ante una petición genérica ("quiero hacerme las uñas") o un término coloquial ("pintura en gel"), el asistente pregunta/aclara antes de asumir, y resuelve sinónimos vía `TermSynonym`.
- **Backend**: Tabla `TermSynonym`, lógica de resolución de sinónimos antes de invocar tools de catálogo.
- **Frontend**: Chat muestra las preguntas de aclaración del asistente.
- **Acceptance Criteria**: "quiero pintura en gel" resuelve a Manicure Gel o Pedicure Gel según contexto, preguntando si no está claro cuál.
- **Security**: N/A.
- **Tests**: Casos de prueba con las frases de equivalencia listadas en `System_Prompt_Asistente_OopssNails.docx`.

### UJ-03: Browse the service catalog via `/servicios`

- **Description**: La clienta puede explorar el catálogo completo sin chatear primero.
- **Backend**: `GET /services` (ya cubierto en UJ-01).
- **Frontend**: Página `/servicios` con tabs/acordeón por categoría.
- **Acceptance Criteria**: Las 9 categorías del catálogo se listan con precios correctos; "Agendar este servicio" enlaza al chat con contexto preseleccionado.
- **Security**: Ruta pública, solo lectura.
- **Tests**: N/A (verificación manual de UI).

### UJ-04: Ask which specialist performs a given service

- **Description**: La clienta pregunta quién hace un servicio específico.
- **Backend**: `GET /services/:id` (incluye especialistas asociados vía `SpecialistService`).
- **Frontend**: Respuesta del asistente en chat.
- **Acceptance Criteria**: Preguntar "¿quién hace Rubber Gel?" devuelve Yez, Tania y Mariangely (no a Aurora ni Sonia).
- **Security**: N/A.
- **Tests**: Verificar que la restricción de Yez (solo 3 servicios) se refleja correctamente.

### UJ-05: Upload a reference photo within an ongoing chat

- **Description**: La clienta adjunta una foto de diseño de uñas o de su cabello.
- **Backend**: `POST /uploads`, asociación con `Message.attachmentId`.
- **Frontend**: Botón de adjuntar en el input de chat, previsualización de la imagen enviada.
- **Acceptance Criteria**: La foto sube, se asocia al mensaje, y es visible en el historial de la conversación.
- **Security**: Validación de mime/tamaño (IT-07); solo el dueño de la sesión puede ver su propio adjunto.
- **Tests**: Test de subida con archivo válido/inválido.

## M2: Booking Flow

### UJ-06: Check specialist availability

- **Description**: El asistente consulta horarios reales disponibles para un servicio y fecha dados.
- **Backend**: `POST /availability/check`, respetando `SpecialistService`, `ScheduleRule`, `ScheduleConstraint`, `ScheduleException`, y citas ya existentes.
- **Frontend**: Chat muestra las opciones de horario ofrecidas.
- **Acceptance Criteria**: Consultar disponibilidad de Yez un sábado después de las 5pm no devuelve slots; consultar a Ana María antes de las 11am tampoco.
- **Security**: Ruta pública de solo lectura, sin datos sensibles de clientas expuestos.
- **Tests**: Casos de horario límite por especialista (Yez 7pm/5pm, Tania/Mariangely 4pm sábado, Aurora 4:30pm/6pm, Ana María 11am).

### UJ-07: Book an appointment end-to-end via chat

- **Description**: Flujo completo servicio → especialista → horario → datos de contacto → confirmación → cita persistida con código.
- **Backend**: `POST /appointments` con revalidación transaccional (constraint único especialista+franja para evitar doble reserva).
- **Frontend**: Tarjeta de resumen/confirmación in-chat antes de cerrar la cita.
- **Acceptance Criteria**: Al confirmar, se crea la cita y se muestra un código de confirmación; un segundo intento de reservar el mismo slot falla con 409.
- **Security**: Validación de entrada en todos los campos de contacto; el precio/duración se toma del catálogo real, nunca de lo que "diga" el modelo.
- **Tests**: Test de conflicto de doble reserva; test de reserva válida de múltiples servicios en una sola cita.
- **Ampliación post-entrega (2026-08-04, `GuidedBooking.tsx`)**: además del flujo conversacional por texto, existe un asistente de agendamiento 100% por clics (categoría → servicio → especialista → fecha → hora → datos de contacto → confirmar), disponible desde un botón "📅 Agendar cita" siempre visible en `/`. No pasa por el modelo de IA en ningún paso — usa directamente `GET /services`, `GET /services/:id`, `POST /availability/check` y `POST /appointments`, los mismos endpoints que ya usan el chat y el admin, así que no hay riesgo de invención de datos durante el agendamiento guiado. El paso de especialista se omite automáticamente si el servicio solo tiene una especialista asignada. Pedido explícito del usuario para reducir la fricción de escribir.
- **Ampliación post-entrega #2 (2026-08-04, `ChatWelcome.tsx`)**: el estado inicial del chat (sin mensajes) ahora muestra un saludo + un menú de categorías con checkbox (selección múltiple, hasta 3) en vez del placeholder anterior — lo primero que ve cualquier visitante, sin necesidad de tocar el botón "Agendar cita". Al marcar varias categorías y enviar, se muestran los servicios combinados de esas categorías agrupados por categoría; al elegir uno, continúa por los mismos pasos compartidos (`BookingStepsPanel.tsx`, usado también por `GuidedBooking.tsx`). Un enlace "Prefiero escribir mi pregunta →" descarta la bienvenida y vuelve al chat de texto libre normal.

### UJ-08: View an upcoming appointment via phone + confirmation code

- **Description**: Autoservicio de consulta de cita sin cuenta.
- **Backend**: `GET /appointments/lookup?phone&code`.
- **Frontend**: Página `/mis-citas` con formulario de búsqueda.
- **Acceptance Criteria**: Combinación correcta de teléfono+código muestra el detalle; combinación incorrecta no filtra información (mensaje genérico "no encontrado").
- **Security**: Rate-limit sobre el endpoint para evitar fuerza bruta del código.
- **Tests**: Test de lookup válido/inválido, test de rate-limit.

### UJ-09: Cancel or reschedule an upcoming appointment

- **Description**: La clienta cancela o reprograma su propia cita desde `/mis-citas`. **Ampliado más allá del alcance original** (solo cancelar) a petición explícita del usuario durante M2 ("el cliente debe tener la posibilidad de poder agendar, cancelar, mover citas") — ver DEC-08 en `docs/decision_log.md`.
- **Backend**: `POST /appointments/:id/cancel` y `POST /appointments/:id/reschedule`, ambos validados por phone+code (o admin).
- **Frontend**: Botones "Cancelar" (con confirmación) y "Reprogramar" (selector de fecha + búsqueda de horarios reales vía `/availability/check` + selección) en `/mis-citas`.
- **Acceptance Criteria**: Cancelar → la cita pasa a `cancelled` y el slot vuelve a estar disponible. Reprogramar → la cita se mueve a la nueva fecha/hora (re-validada contra el horario real, excluyendo su propia franja actual del chequeo de conflicto) y el horario anterior vuelve a estar disponible.
- **Security**: Misma protección de phone+code que UJ-08 para ambas acciones.
- **Tests**: Test de cancelación válida/inválida; test de reprogramación válida/inválida/slot no disponible/cita no reprogramable.

### UJ-10: Human escalation handoff

- **Description**: Casos donde el asistente no tiene certeza (facial/estética, zona de láser, precio "desde" de cabello) se derivan a un humano.
- **Backend**: `POST /chat/sessions/:id/escalate`, creación de `EscalationFlag` con `reason` y `assignedSpecialistId` sugerido (ej. Sonia, Aurora).
- **Frontend**: Mensaje del asistente informando que un especialista dará seguimiento.
- **Acceptance Criteria**: Una pregunta de recomendación facial ambigua genera un `EscalationFlag` visible en `/admin/escalamientos` con `reason=facial_recommendation` y `assignedSpecialistId` de Sonia.
- **Security**: N/A.
- **Tests**: Casos de prueba para las 3 reglas de escalamiento explícitas del system prompt (facial/estética con Sonia, zona de láser con Sonia, precio "desde" de cabello con Aurora).

## M3: Admin Foundations

### UJ-11: Admin login

- **Description**: El admin inicia sesión para acceder al panel.
- **Backend**: Cubierto por IT-03.
- **Frontend**: Página `/admin/login`.
- **Acceptance Criteria**: Login válido redirige al dashboard; inválido muestra error sin filtrar si el email existe.
- **Security**: Sin enumeración de usuarios vía mensajes de error diferenciados.
- **Tests**: Test de login válido/inválido.

### UJ-12: Admin dashboard / lifecycle visibility

- **Description**: Vista general de salud del sistema y operación del día.
- **Backend**: Cubierto por IT-10, más agregación de citas de hoy y conteo de escalamientos.
- **Frontend**: `/admin` con widgets de salud, citas de hoy, escalamientos abiertos.
- **Acceptance Criteria**: Los widgets reflejan datos reales (verificar apagando la DB o simulando fallo de OpenAI en dev).
- **Security**: Ruta admin-only.
- **Tests**: N/A (verificación manual + tests de IT-10).

### UJ-13: Manage services & prices

- **Description**: El admin crea/edita/desactiva servicios y precios del catálogo.
- **Backend**: `POST/PUT/DELETE /admin/services`, `/admin/service-categories`.
- **Frontend**: `/admin/servicios` con tabla y formulario de edición.
- **Acceptance Criteria**: Editar un precio se refleja inmediatamente en `/servicios` y en las respuestas del chat.
- **Security**: Admin-only; validación de precio no negativo y consistencia priceType/priceMax.
- **Tests**: Test de validación de campos inválidos.

### UJ-14: Manage staff and their allowed services

- **Description**: El admin gestiona especialistas y qué servicios atiende cada uno.
- **Backend**: `POST/PUT/DELETE /admin/specialists`, `PUT /admin/specialists/:id/services`.
- **Frontend**: `/admin/personal` con checklist de servicios por especialista.
- **Acceptance Criteria**: Desasignar un servicio de un especialista hace que ya no aparezca como opción válida en el chat ni en `/availability/check`.
- **Security**: Admin-only.
- **Tests**: Test de que la restricción se refleje en `/availability/check` inmediatamente tras la edición.

### UJ-15: Manage specialist schedules

- **Description**: El admin configura horario semanal, restricciones de último horario y excepciones por especialista.
- **Backend**: `GET/PUT /admin/specialists/:id/schedule`, `POST/DELETE /admin/specialists/:id/schedule-exceptions`.
- **Frontend**: `/admin/personal/:id/horario` con grid semanal y calendario de excepciones.
- **Acceptance Criteria**: Marcar un día libre para un especialista elimina todos sus slots disponibles ese día en `/availability/check`.
- **Security**: Admin-only.
- **Tests**: Test de excepción de día libre y de restricción de último horario.

## M4: Admin Operations & Governance

### UJ-16: View and manage appointments

- **Description**: El admin ve todas las citas y puede crearlas/editarlas/cancelarlas manualmente.
- **Backend**: `GET /admin/appointments`, `PUT /admin/appointments/:id`.
- **Frontend**: `/admin/citas` con filtros y modal de edición.
- **Acceptance Criteria**: Filtrar por especialista y fecha muestra solo las citas correspondientes; edición manual respeta las mismas reglas de conflicto que la reserva vía chat.
- **Security**: Admin-only.
- **Tests**: Test de que una edición manual no pueda crear un conflicto de doble reserva.

### UJ-17: Manage credentials (OpenAI key)

- **Description**: El admin rota la API key de OpenAI sin ayuda de un desarrollador.
- **Backend**: Cubierto por IT-06, expuesto vía `GET/PUT /admin/credentials`.
- **Frontend**: `/admin/credenciales` con valores enmascarados.
- **Acceptance Criteria**: Actualizar la key se refleja en la siguiente llamada al `AIProvider` sin reiniciar el contenedor.
- **Security**: El valor completo nunca se devuelve tras guardarlo, solo enmascarado.
- **Tests**: Test de que el valor persistido esté cifrado en la base de datos.

### UJ-18: Edit knowledge base (synonyms + policy text)

- **Description**: El admin edita equivalencias de términos y fragmentos de política del asistente.
- **Backend**: `GET/POST/DELETE /admin/knowledge-base/synonyms`, `GET/PUT /admin/knowledge-base/policies`.
- **Frontend**: `/admin/conocimiento` con CRUD de sinónimos y editor de texto de políticas.
- **Acceptance Criteria**: Añadir un nuevo sinónimo se refleja en la próxima conversación de chat sin necesidad de redeploy.
- **Security**: Admin-only; el texto de políticas se inyecta en el system prompt, así que debe sanearse contra intentos de prompt injection vía este mismo panel (validación de longitud/contenido razonable).
- **Tests**: Test de que un sinónimo nuevo resuelva correctamente en una conversación de prueba.

### UJ-19: Resolve the escalation queue

- **Description**: El admin ve y resuelve los casos derivados a humano.
- **Backend**: `GET /admin/escalations`, `PUT /admin/escalations/:id/resolve`.
- **Frontend**: `/admin/escalamientos` con lista filtrable y enlace a la conversación.
- **Acceptance Criteria**: Marcar un escalamiento como resuelto lo mueve fuera de la vista "abiertos" del dashboard.
- **Security**: Admin-only.
- **Tests**: Test de transición de estado `open` → `resolved`.

(Populated during planning phase)
