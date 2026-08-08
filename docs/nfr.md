# Non-Functional Requirements

## Performance

- Un solo salón, 6 especialistas, tráfico bajo/medio — no se requiere infraestructura de alta escala.
- Respuesta del asistente: primer token del stream SSE en menos de ~2s bajo condiciones normales de la API de OpenAI.
- Chequeo de disponibilidad (`/availability/check`): respuesta en menos de 500ms (consulta indexada sobre `Appointment`/`ScheduleRule`).

## Security

- Autenticación: JWT + bcrypt para el rol Admin (único rol autenticado). Ver `design/architecture.md` para mapeo completo de credenciales.
- Credential levels: Level 1 (.env), Level 2 (deployment), Level 3 (admin panel encrypted) — ver tabla completa en `design/architecture.md`.
- Cifrado en reposo de credenciales Nivel 3 vía `ENCRYPTION_KEY`.
- Validación de entrada en todos los endpoints públicos (chat, uploads, appointments) — especialmente en `/appointments` y `/appointments/:id/cancel`, que son alcanzables sin sessionToken (solo phone+code).
- Autoservicio de citas (phone+code) no debe permitir enumeración: rate-limit sobre `/appointments/lookup` y `/appointments/:id/cancel`.
- Subida de archivos: validar mime type y tamaño (`MAX_UPLOAD_SIZE_MB`) antes de persistir; servir uploads solo por ruta autenticada, nunca desde un directorio público listable.

## Accessibility

- WCAG 2.1 AA como objetivo (contraste 4.5:1, navegación por teclado, indicadores de foco) — ver `design/style_guide.md`.
- El chat debe ser usable con lector de pantalla (roles ARIA en burbujas de mensaje, anuncio de nuevos mensajes).

## Observability

- Endpoint agregado de salud (`/admin/dashboard/health`): conectividad DB, alcance de API de OpenAI, uso de disco, conteo de escalamientos abiertos.
- `ErrorLog` ligero para errores relevantes al dashboard admin; logs de contenedor (stdout) siguen siendo la fuente de verdad para depuración profunda — no se requiere un agregador de logs externo para este alcance.
- Auditoría de tool-calls del asistente (`Message.toolCallMeta`) para poder revisar qué función invocó el modelo en cada turno — clave para depurar casos cercanos a alucinación (ver R1 en `planning/risks.md`).

## Scalability

- Diseño de host único (un salón) — no se proyecta necesidad de escalamiento horizontal.
- Almacenamiento de archivos local por ahora; documentado como intercambiable por almacenamiento compatible con S3 si el proyecto creciera a multi-sucursal (fuera de alcance actual, ver `planning/scope.md`).

(Populated during planning)
