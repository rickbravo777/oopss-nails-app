# Requirements

## Functional Requirements

- **FR-01**: Un chat web (PC y móvil) donde la clienta conversa con un asistente de IA sobre servicios, precios y especialistas del salón.
- **FR-02**: El asistente identifica el servicio exacto que la clienta necesita, incluso cuando lo describe de forma imprecisa (ej. "quiero hacerme las uñas"), preguntando antes de asumir.
- **FR-03**: El asistente reconoce equivalencias de términos (ej. "pintura en gel"/"esmalte semipermanente"/"semipermanente" = Manicure Gel o Pedicure Gel), gestionadas como datos editables, no hardcodeadas en el prompt.
- **FR-04**: El asistente respeta estrictamente qué servicios atiende cada especialista (ej. Yez solo Polygel/Rubber Gel/extensión Polygel) — el sistema rechaza a nivel de servidor cualquier combinación especialista-servicio inválida, independientemente de lo que decida el modelo de IA.
- **FR-05**: El asistente verifica disponibilidad real contra el calendario de cada especialista antes de confirmar una cita — nunca inventa horarios ni disponibilidad.
- **FR-06**: El asistente nunca inventa precios; siempre consulta el catálogo real de servicios.
- **FR-07**: La clienta puede agendar una cita completa (servicio(s) + especialista + día + hora) de principio a fin dentro de la conversación, con confirmación explícita antes de cerrarla.
- **FR-08**: Si la clienta solicita varios servicios, el asistente confirma todos los detalles de cada uno antes de agendar la cita completa.
- **FR-09**: La clienta puede subir fotos (referencia de diseño de uñas, foto de cabello para servicios "desde") dentro de la conversación.
- **FR-10**: El historial de conversación se guarda por clienta/sesión y es accesible desde web y móvil.
- **FR-11**: El sistema escala a un humano cuando el asistente no tiene certeza (ej. recomendaciones de Sonia en faciales/estética, evaluación de precio de cabello por Aurora, confirmación de zona en depilación láser con Sonia).
- **FR-12**: La clienta puede consultar y cancelar una cita próxima usando su teléfono + un código de confirmación (sin necesidad de cuenta con contraseña).
- **FR-13**: El sistema registra cada cita confirmada (servicio(s), especialista, fecha, hora, cliente) para seguimiento del salón.
- **FR-14**: El administrador puede gestionar (crear/editar/eliminar) el catálogo de servicios y precios sin depender de un desarrollador.
- **FR-15**: El administrador puede gestionar el personal: qué servicios atiende cada especialista, sus horarios semanales, restricciones (ej. último servicio de Yez a las 7pm) y excepciones (día libre, horario especial).
- **FR-16**: El administrador puede ver y gestionar las citas agendadas (filtrar, crear/editar/cancelar manualmente).
- **FR-17**: El administrador puede gestionar credenciales del sistema (ej. rotar la API key de OpenAI) desde el panel, sin tocar código ni variables de entorno del servidor.
- **FR-18**: El administrador puede editar la base de conocimiento del asistente: equivalencias de términos y fragmentos de política/reglas de negocio inyectados al system prompt.
- **FR-19**: El administrador tiene un panel de visibilidad del ciclo de vida del sistema (salud de la base de datos, conectividad con OpenAI, citas del día, escalamientos pendientes).
- **FR-20**: El administrador puede ver y resolver la cola de escalamientos a humano.

## Non-Functional Requirements

See `docs/nfr.md` for detailed non-functional requirements.

## User Roles

- **Clienta**: usa el chat público para informarse y agendar citas. Sin cuenta/contraseña — identificada por nombre + teléfono; consulta/cancela citas con teléfono + código de confirmación.
- **Especialista** (Yez, Tania, Mariangely, Aurora, Ana María, Sonia): entidad de datos con servicios y horarios asociados; sin login individual en v1 (ver Assumption A3 en `planning/questions.md`).
- **Administrador/dueño del salón**: acceso completo al panel admin — gestión de catálogo, personal, horarios, citas, credenciales, base de conocimiento y visibilidad del sistema. Único rol con autenticación (JWT + bcrypt).

(Populated during planning with /init-project)
