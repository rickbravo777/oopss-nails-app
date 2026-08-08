# Risk Register

## Format

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|

## Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | El modelo de IA "alucina" precios, horarios o disponibilidad inexistentes | Med | High | Arquitectura de tool-calling obligatorio: el modelo nunca declara un precio/horario de memoria, siempre llama a funciones del backend que leen la base de datos real; el backend revalida independientemente antes de persistir cualquier cita. |
| R2 | Identificación ambigua de servicio lleva a asignar la clienta al especialista equivocado (ej. pedir Manicure Gel con Yez) | Med | High | Restricción dura a nivel de base de datos (tabla `SpecialistService`) que rechaza cualquier combinación especialista-servicio inválida, sin importar lo que decida el modelo. |
| R3 | Sin depósito/anticipo, las inasistencias (no-shows) no tienen desincentivo | High | Med | Aceptado explícitamente para v1 por decisión del usuario; documentado como mejora futura (posible integración de pagos). |
| R4 | Las duraciones de servicio son estimaciones hasta que el salón las corrija con datos reales, pudiendo causar huecos o solapes en el calendario | High | Med | Duración editable por servicio y por especialista desde el día uno (panel admin); el salón corrige valores tras operar unas semanas. |
| R5 | Postgres de host único y almacenamiento de fotos en disco local sin estrategia de respaldo | Low | High | Documentar y verificar antes de entrega: respaldo programado (`pg_dump` o snapshot de volumen) y volumen nombrado correctamente montado para `/app/uploads`. |
| R6 | Una caída o rate-limit de OpenAI bloquea el único canal de atención al cliente (el chat) | Low | High | Mensaje de fallback amigable al cliente, visibilidad de salud en el dashboard admin, y capacidad del admin de crear/editar citas manualmente como canal alterno. |
| R7 | Expansión silenciosa del "editor de base de conocimiento" hacia un motor de reglas genérico no planeado | Med | Med | Alcance delimitado explícitamente (flags estructurados + fragmentos de texto acotados, no un DSL) — cualquier expansión debe documentarse como decisión explícita, no implementarse de forma incremental sin discusión. |
| R8 | Información pendiente de confirmar con el cliente real del salón (moneda, cobertura de Extensión de Acrílico) resulta distinta a lo asumido | Low | Low | Cambios de un solo campo o de datos admin-editables, no requieren cambio de esquema ni de arquitectura (ver `planning/questions.md`). |

(Populated during planning with /init-project)
