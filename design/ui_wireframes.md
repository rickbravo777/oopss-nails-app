# UI Wireframes

## Navigation Structure

**Sitio público** (sin login):
- `/` — Chat (pantalla principal, catálogo accesible desde el mismo lugar)
- `/servicios` — Catálogo de servicios
- `/mis-citas` — Consultar/cancelar cita (teléfono + código)

**Panel admin** (`/admin/*`, requiere login):
- Sidebar: Dashboard · Servicios · Personal · Horarios · Citas · Escalamientos · Credenciales · Base de Conocimiento

## Key Screens

### Chat (público)

- **Route**: `/`
- **Purpose**: Conversar con el asistente para informarse y agendar una cita.
- **Layout**: Encabezado con el logo de marca (`logo-lockup.png`, post-entrega) y botón "📅 Agendar cita" siempre visible. Ventana de chat centrada, historial de mensajes con burbujas usuario/asistente, input de texto + botón de adjuntar foto, indicador de "escribiendo" durante streaming SSE.
- **Actions**: Enviar mensaje, adjuntar foto, ver resumen de cita propuesta (tarjeta de confirmación in-chat con servicio(s)/especialista/fecha/hora antes de confirmar), solicitar hablar con un humano.
- **Estado inicial (post-entrega, `ChatWelcome.tsx`)**: mientras la conversación no tiene mensajes, en vez de un placeholder se muestra un saludo de bienvenida (mensaje de marca, ver `backend/src/lib/ai/systemPrompt.ts`'s "SALUDO INICIAL") seguido inmediatamente por el mismo selector de un solo toque descrito abajo (`ServiceBookingFlow.tsx`) — sin checkboxes ni botón "Enviar" intermedio. Enlace "Prefiero escribir mi pregunta →" para descartarlo y usar el chat libre.
- **Selector de agendamiento por clics, un solo toque (post-entrega, `frontend/src/components/booking/ServiceBookingFlow.tsx`)**: categoría → servicio → especialista (se omite si solo hay una) → fecha (chips de los próximos 7 días) → hora (horarios reales) → datos de contacto → confirmar → código de confirmación, con barra de progreso opcional. Cada paso es un solo toque (nunca checkbox + enviar). No pasa por el modelo de IA — usa `GET /services`, `GET /services/:id`, `POST /availability/check`, `POST /appointments` directamente. **Un solo componente, usado en tres lugares**: (1) el estado inicial del chat (`ChatWelcome.tsx`, arriba), (2) el modal "📅 Agendar cita" (`GuidedBooking.tsx`, solo aporta el chrome del modal), y (3) **inline, dentro de la conversación de texto libre** — ver más abajo.
- **Selector inline dentro del chat libre (post-entrega)**: cuando la clienta escribe algo con intención de agendar sin haber especificado un servicio (ej. "quiero una cita"), el asistente llama a la herramienta `offer_service_selection` (sin efecto en el backend — es una señal) en vez de preguntar en texto; el frontend detecta esa llamada en `toolCallMeta` del mensaje y renderiza el mismo `ServiceBookingFlow` justo debajo de la burbuja del asistente. Esto hace que la selección por clics esté disponible en cualquier punto de la conversación, no solo al inicio — y de paso evita ambigüedad al identificar especialistas (ver "NOMBRES DE ESPECIALISTAS" en `systemPrompt.ts`: variantes de nombre como "Yetzebell"/"Yetze" para la especialista "Yez" se resuelven correctamente incluso si la clienta sigue escribiendo en vez de usar el selector).

### Catálogo de servicios (público)

- **Route**: `/servicios`
- **Purpose**: Explorar servicios y precios por categoría sin necesidad de chatear primero.
- **Layout**: Tabs o acordeón por categoría (Manos, Pies, Cabello, etc.), tarjetas de servicio con nombre, precio (o badge "Desde $X"), duración estimada.
- **Actions**: "Agendar este servicio" abre/enlaza al chat con el servicio pre-seleccionado como contexto.

### Mis Citas (público)

- **Route**: `/mis-citas`
- **Purpose**: Autoservicio de ver/cancelar una cita sin cuenta.
- **Layout**: Formulario simple (teléfono + código de confirmación) → tarjeta de detalle de cita.
- **Actions**: Cancelar cita (con confirmación).

### Admin — Dashboard

- **Route**: `/admin`
- **Purpose**: Visibilidad del ciclo de vida del sistema y del día operativo.
- **Layout**: Widgets de salud (DB, OpenAI, disco), lista de citas de hoy, contador de escalamientos abiertos con acceso directo.
- **Actions**: Ir a escalamientos, ir a citas del día.

### Admin — Servicios

- **Route**: `/admin/servicios`
- **Purpose**: Gestionar catálogo y precios sin depender de un desarrollador.
- **Layout**: Tabla agrupada por categoría, filtros, botón "nuevo servicio", edición inline o modal (precio, priceType, duración, flags requiresConsultation/requiresPhoto).
- **Actions**: Crear, editar, desactivar servicio.

### Admin — Personal

- **Route**: `/admin/personal`
- **Purpose**: Gestionar especialistas y qué servicios atiende cada uno.
- **Layout**: Lista de especialistas → detalle con checklist de servicios asignables (agrupados por categoría) y overrides de duración opcionales.
- **Actions**: Crear/editar especialista, asignar/desasignar servicios.

### Admin — Horarios

- **Route**: `/admin/personal/:id/horario`
- **Purpose**: Configurar horario semanal, restricciones de último horario y excepciones puntuales por especialista.
- **Layout**: Grid semanal (día × hora inicio/fin), lista de `ScheduleConstraint` (ej. "sábados, último inicio 4:00pm"), calendario de excepciones (día libre / horario especial).
- **Actions**: Editar horario semanal, añadir/eliminar restricción, añadir/eliminar excepción.

### Admin — Citas

- **Route**: `/admin/citas`
- **Purpose**: Ver y gestionar todas las citas agendadas.
- **Layout** (post-entrega — rediseño visual tipo Google Calendar): selector de tres vistas — **Semana** (columnas por día, bloques de cita coloreados por especialista), **Día por especialista** (columnas por especialista, útil para ver quién está libre en un momento dado) y **Lista** (la vista original con filtros por fecha/especialista/estado). Leyenda de colores por especialista (color estable, derivado del id, no de la posición). Un mismo modal de edición compartido entre las tres vistas.
- **Actions**: Crear cita manual (vía el mismo `POST /appointments` que usa el chat), editar (clic en un bloque del calendario o "Editar" en la lista — reprogramar reutiliza la misma validación de conflictos que la reserva por chat), cancelar, cambiar estado (ej. marcar `no_show`, resolver `pending_confirmation`).

### Admin — Escalamientos

- **Route**: `/admin/escalamientos`
- **Purpose**: Cola de casos donde el asistente pidió intervención humana.
- **Layout**: Lista filtrable por estado (abierto/resuelto) y razón, enlace a la conversación original.
- **Actions**: Ver conversación, marcar como resuelto con notas.

### Admin — Credenciales

- **Route**: `/admin/credenciales`
- **Purpose**: Rotar secretos Nivel 3 (ej. API key de OpenAI) sin ayuda de un desarrollador.
- **Layout**: Lista de claves con valor enmascarado, botón "editar" por clave con confirmación.
- **Actions**: Actualizar valor de una credencial.

### Admin — Base de Conocimiento

- **Route**: `/admin/conocimiento`
- **Purpose**: Editar equivalencias de términos y fragmentos de política del asistente.
- **Layout**: Tabla CRUD de sinónimos (término → servicio/categoría canónico), editor de texto para cada fragmento de `AssistantPolicy`.
- **Actions**: Crear/editar/eliminar sinónimo, editar texto de política.

## User Flows

### Agendar cita vía chat

1. Clienta escribe su necesidad (ej. "quiero hacerme las uñas").
2. Asistente pregunta el servicio exacto (o guía con preguntas si no lo sabe).
3. Asistente confirma especialista/técnica (o pregunta si no tiene preferencia) — validado contra `SpecialistService`.
4. Asistente llama a `/availability/check` y ofrece horarios reales.
5. Clienta elige día/hora; si pidió más de un servicio, se confirman todos.
6. Asistente muestra resumen completo (servicio(s) + especialista + día + hora) y pide confirmación explícita.
7. Al confirmar, se llama a `POST /appointments` (revalidación transaccional) → se muestra código de confirmación.

### Consultar/cancelar cita sin cuenta

1. Clienta va a `/mis-citas`, ingresa teléfono + código.
2. Ve detalle de la cita.
3. Si cancela, se llama a `POST /appointments/:id/cancel` con phone+code.

### Escalamiento a humano

1. Durante el chat, se detecta un caso de incertidumbre (ej. recomendación facial, zona de láser, precio "desde" de cabello).
2. Asistente informa a la clienta que un especialista la contactará y llama a la herramienta `escalate_to_human` (no existe una ruta REST independiente para esto — es una desviación documentada del contrato original, ver hallazgo 2 del `/review` de `{M1+M2}` en `docs/work_log.md` y el registro de riesgos residuales al final del mismo archivo).
3. El caso aparece en `/admin/escalamientos` para seguimiento por el admin, incluyendo un enlace "Ver conversación" para leer la transcripción completa (añadido en el `/review` de `{M3+M4}`).

### Agendar cita sin escribir (post-entrega)

1. Clienta abre `/` y ve el saludo + categorías de un solo toque, o hace clic en "📅 Agendar cita" en cualquier momento de la conversación.
2. Toca una categoría → ve los servicios de esa categoría.
3. Toca un servicio → si tiene más de una especialista asignada, toca una (se omite el paso si solo hay una).
4. Toca una fecha (chip de uno de los próximos 7 días) → ve horarios reales de `POST /availability/check` para esa especialista/fecha/servicio.
5. Toca un horario → ingresa nombre y teléfono → ve el resumen y confirma.
6. Se llama a `POST /appointments` (el mismo endpoint y la misma revalidación que usa el flujo por chat) → se muestra código de confirmación. Puede agendar otra cita o volver al chat libre.

### Agendar cita dentro del chat libre, sin haber especificado el servicio (post-entrega)

1. Clienta escribe algo con intención de agendar pero sin nombrar un servicio exacto (ej. "quiero una cita", "quiero hacerme las uñas").
2. En vez de preguntar en texto, el asistente llama a `offer_service_selection` (tool call sin efecto de backend) — el frontend ve esto en `toolCallMeta` del mensaje y muestra el selector de un solo toque (`ServiceBookingFlow.tsx`) justo debajo de la respuesta del asistente.
3. Continúa igual que "Agendar cita sin escribir" desde el paso 2 en adelante — el resto del flujo tampoco pasa por la IA.
4. La clienta puede seguir escribiendo libremente en cualquier momento (el selector inline no bloquea el input de texto) — si menciona una especialista por un nombre distinto al registrado (ver "NOMBRES DE ESPECIALISTAS" en `systemPrompt.ts`), el asistente lo resuelve al nombre exacto antes de cualquier llamada a `check_availability`/`create_appointment`.

(Populated during planning with /init-project)
