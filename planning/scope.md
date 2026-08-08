# Scope

## In Scope

- Chat web conversacional (widget en sitio propio, PC y móvil) con asistente de IA vía OpenAI SDK.
- Identificación guiada de servicio, especialista y horario, con reconocimiento de equivalencias de términos.
- Calendario/agenda propio por especialista, construido dentro de la app (sin integración externa).
- Agendamiento de cita real (uno o varios servicios) con verificación de disponibilidad y confirmación explícita.
- Subida y almacenamiento de fotos de referencia (diseño de uñas, cabello para servicios "desde").
- Historial de conversación por clienta/sesión.
- Mecanismo de escalamiento a humano (cola de handoff visible en el panel admin).
- Consulta/cancelación de cita por parte de la clienta vía teléfono + código de confirmación (sin cuenta).
- Registro de citas confirmadas para seguimiento del salón.
- Panel de administración: login (JWT + bcrypt), gestión de servicios/precios, gestión de personal y horarios (reglas semanales + excepciones), gestión de citas, gestión de credenciales (vault Nivel 3), editor de base de conocimiento (equivalencias + fragmentos de política), panel de salud/visibilidad del sistema.
- Página pública de catálogo de servicios (`/servicios`).
- Despliegue Docker (backend + frontend + Postgres), preparado para EasyPanel.
- Seed script con datos de demostración (catálogo completo, personal, horarios) antes de la entrega.

## Out of Scope

- Integración con WhatsApp Business API o Instagram DM (confirmado con el usuario: solo chat web propio).
- Sincronización con Google Calendar u otro calendario externo (confirmado: calendario propio autocontenido).
- Cobro de depósito/anticipo o cualquier integración de pagos (Stripe u otra pasarela) — sin política de pago en esta versión.
- Cuentas de clienta con contraseña/registro (se usa nombre + teléfono + código de confirmación).
- Login o dashboard individual para especialistas (solo el admin gestiona horarios/citas en v1).
- Motor de reglas de negocio genérico/DSL para la base de conocimiento — se usa un conjunto acotado de flags estructurados (`requiresConsultation`, `SpecialistService`, `ScheduleConstraint`) más fragmentos de texto editables, no un motor de reglas completo.
- Venta formal de paquetes prepagados con seguimiento de créditos para depilación láser (se registra sesión por sesión).
- Notificaciones por email/SMS (confirmaciones, recordatorios) — no mencionadas en el material fuente; se puede añadir en una iteración futura si el salón lo solicita.
- Multi-sucursal o multi-tenant — el sistema asume un único salón (Oopss Nails).

## Assumptions

- Ver `planning/questions.md` para la lista completa de assumptions (A1–A7) que afectan decisiones de alcance (moneda, cobertura de Extensión de Acrílico, ausencia de login de especialistas, duraciones estimadas, identificación de clienta sin cuenta, estado de citas "desde", tratamiento de paquetes láser).

(Populated during planning with /init-project)
