# System Architecture

## Overview

Oopss Nails es una plataforma de agendamiento de un solo salón con un asistente conversacional de IA como interfaz principal de la clienta. La app tiene dos superficies: un **sitio público** (chat + catálogo + autoservicio de citas) y un **panel de administración** (gestión de catálogo, personal, horarios, citas, credenciales y base de conocimiento). Ambas comparten el mismo backend Express y la misma base de datos Postgres.

El flujo central: la clienta conversa con el asistente → el asistente (vía OpenAI SDK con tool-calling) llama a funciones del backend para consultar servicios, especialistas y disponibilidad real → el backend valida cada paso (qué especialista puede hacer qué servicio, qué horarios están libres) → solo entonces se persiste una cita. El modelo de IA nunca es la fuente de verdad de precios/horarios/disponibilidad — solo orquesta la conversación y decide qué función llamar.

## Components

- **Backend**: Node.js + Express + TypeScript, organizado en capas (routes → controllers → services → repositories/Prisma). Módulos: auth, chat/assistant, services (catálogo), specialists, availability, appointments, uploads, admin (credentials, knowledge-base, dashboard, escalations).
- **Frontend**: React + TypeScript + Vite, Tailwind CSS. Dos apps montadas en el mismo build: sitio público (chat widget, `/servicios`, `/mis-citas`) y `/admin/*` (panel protegido). React Query para estado de servidor; Context/Zustand ligero para UI (tema, estado del widget).
- **Database**: PostgreSQL 16 vía Prisma ORM. Migraciones versionadas en el repo. Ver `design/data_model.md` para entidades completas.
- **Authentication**: JWT + bcrypt para el rol Admin (único rol autenticado). Las clientas usan un `sessionToken` anónimo para continuidad de conversación, y teléfono + código de confirmación para autoservicio de citas (sin contraseña).

## Credential Level Mapping

- **Level 1 (.env)**: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_SESSION_SECRET` (firma tokens de sesión anónimos de clientas, separado del JWT admin), `ENCRYPTION_KEY` (cifra los valores Nivel 3), `NODE_ENV`, `PORT`.
- **Level 2 (deployment)**: `OPENAI_MODEL` (ej. `gpt-4o-mini` — ajuste técnico/de costo, no secreto), `ADMIN_INITIAL_EMAIL`/`ADMIN_INITIAL_PASSWORD` (solo para el seed inicial; después el admin real vive como hash bcrypt en la DB), `CORS_ALLOWED_ORIGIN`, `UPLOADS_DIR`, `MAX_UPLOAD_SIZE_MB`.
- **Level 3 (admin panel, cifrado)**: `OPENAI_API_KEY` — el dueño del salón debe poder rotarla sin depender de un desarrollador (cambios de cuenta de facturación, rotación de key organizacional). Almacenada en una tabla `Credential` genérica clave-valor cifrada con `ENCRYPTION_KEY`, enmascarada en la UI (ej. `sk-...abcd`). Diseñada como vault genérico para que futuros secretos Nivel 3 (ej. credenciales SMTP si se añaden notificaciones) no requieran cambio de esquema.

## Integration Points

- **OpenAI SDK**: único servicio externo. Integrado detrás de una interfaz `AIProvider` (ver `design/stack_selection.md`) con function/tool-calling. Sin otras integraciones de terceros (confirmado: sin WhatsApp, sin Instagram, sin Google Calendar, sin pasarela de pagos — ver `planning/scope.md`).
- **Almacenamiento de archivos**: local (volumen Docker), no un servicio externo.
- **Health checks**: endpoint agregado (`/admin/dashboard/health`) que verifica conectividad a DB, alcance de la API de OpenAI, y espacio en disco — consumido por el dashboard admin, no expuesto públicamente.

(Populated during planning with /init-project)
