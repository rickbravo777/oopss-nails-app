# Stack Selection

## Selections

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | Node.js + Express + TypeScript | Encaja con los defaults de la plantilla (`.env.example` ya trae `NODE_ENV`/`PORT`), soporte de primera clase para el SDK de OpenAI, mínima ceremonia para una app de un solo salón. Estructura por capas: routes → controllers → services → repositories. |
| Frontend | React + TypeScript + Vite, Tailwind CSS | Ciclo de desarrollo rápido; las clases utilitarias de Tailwind facilitan glassmorphism (backdrop-blur, bordes translúcidos) y light/dark sin depender de un sistema de diseño pesado. |
| Estado/datos | React Query (server state/caché) + Context/Zustand ligero (tema, estado del widget de chat) | Evita el overhead de Redux; encaja con el alcance reducido de la app. |
| Database | PostgreSQL 16 | Base relacional robusta de host único, buen soporte en EasyPanel, columnas JSON disponibles para los pocos campos flexibles (metadata de tool-calls) sin necesitar un segundo datastore. |
| ORM | Prisma | Schema-as-code con tipado, migraciones integradas, buen ajuste para un catálogo editable por el admin (servicios/especialistas/horarios) donde la claridad del esquema importa. |
| Real-time | Ninguna capa dedicada — Server-Sent Events (SSE) para streaming de respuestas del chat; transacciones de base de datos (constraint único especialista+franja horaria) para evitar doble reserva | Un solo salón con 6 especialistas tiene concurrencia baja; una capa completa de WebSocket/pub-sub (Socket.io, Redis) sería sobre-ingeniería. SSE alcanza para streaming token a token; la seguridad ante conflictos de reserva viene de la transacción de base de datos, no de infraestructura real-time. |
| Almacenamiento de archivos | Directorio `/app/uploads` respaldado por volumen local de Docker/EasyPanel, servido por una ruta de backend autenticada (nombres de archivo UUID aleatorios, sin listado público de directorio) | Evita requerir una cuenta cloud/S3 externa para un despliegue de host único. Documentado como riesgo (R5 en `planning/risks.md`) e intercambiable por un almacén compatible con S3 (ej. MinIO) más adelante si la app necesita escalar a múltiples instancias. |
| Auth | JWT + bcrypt, gestionado por la aplicación, solo para el rol **Admin** | Default de gobernanza. Las clientas nunca necesitan cuenta con contraseña — ver assumption A5 en `planning/questions.md`. |
| AI Provider | OpenAI SDK (paquete npm `openai`) detrás de una interfaz delgada `AIProvider` (`getChatCompletion`, `streamChatCompletion`), usando **function/tool calling** para `check_availability`, `get_service_info`, `create_booking_draft`, etc. | Abstraído por proveedor según gobernanza. El tool-calling es el mecanismo clave anti-alucinación: el modelo nunca declara un precio o franja horaria de memoria — debe llamar a una función del backend que lee la base de datos real, y el backend revalida independientemente antes de persistir nada (ver R1 en `planning/risks.md`). |
| Deployment | Docker Compose, 2 servicios: `app` (backend Express que también sirve los assets estáticos de React compilados) + `db` (Postgres) + volumen nombrado para datos de Postgres + volumen nombrado para uploads | Minimiza el número de servicios para un despliegue de host único en EasyPanel (no se necesita un contenedor separado de nginx/frontend). |

## Alternatives Considered

- **NestJS** en vez de Express: descartado por añadir ceremonia (decoradores, módulos, DI) innecesaria para el tamaño de este proyecto.
- **Next.js** (full-stack) en vez de Express + React separados: descartado porque el template ya separa `backend/`/`frontend/` como repos independientes desplegables, y Express+React encaja mejor con ese patrón sin forzar SSR que no se necesita aquí.
- **Socket.io + Redis** para tiempo real: descartado por sobre-ingeniería frente a SSE + transacciones de base de datos, dado el bajo volumen de concurrencia (un salón, 6 especialistas).
- **Almacenamiento S3/MinIO** desde el día uno: descartado para v1 por simplicidad de despliegue de host único; documentado como ruta de escalamiento futura si se necesita.
- **Sincronización con Google Calendar**: evaluado y descartado por decisión explícita del usuario — calendario propio autocontenido en la app.
