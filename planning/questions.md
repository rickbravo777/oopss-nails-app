# Questions & Assumptions

## Blocking Questions

Resolved with the user during `/init-project` (2026-08-03):

- **Q1: ¿Por qué canal(es) opera el asistente?** → Chat web propio (PC y móvil vía navegador). Sin WhatsApp ni Instagram.
- **Q2: ¿Cómo se maneja el calendario de cada especialista?** → Calendario propio, autocontenido dentro de la app. Sin sincronización con Google Calendar.
- **Q3: ¿Política de depósito/anticipo y cancelación?** → Ninguna en esta versión. Sin cobro de depósito ni integración de pagos. Se documenta como mejora futura.
- **Q4: ¿Cómo resolver la duración de cada servicio (no especificada en el material fuente)?** → Se estiman duraciones por defecto por categoría de servicio (ver `design/data_model.md`), editables desde el panel admin, a corregir con datos reales del salón.

## Non-Blocking Questions

Questions that can be deferred but should be resolved before or during implementation:

- ¿Los especialistas necesitan su propio login para ver su agenda del día, o el panel admin es suficiente para todo el equipo? (Asumido: solo admin en v1 — ver Assumption A3).
- ¿La moneda de los precios es dólares (USD) u otra moneda local? (Asumido: USD — ver Assumption A1).
- ¿Quién realiza la Extensión de Acrílico? Yez solo hace extensión de Polygel. (Asumido: Tania y Mariangely, ya que la tabla de personal indica que ambas atienden "todos los servicios de uñas disponibles" — ver Assumption A2).
- ¿Las clientas deben tener cuenta con contraseña, o basta con identificarlas por nombre + teléfono + código de confirmación? (Asumido: sin cuenta — ver Assumption A5).

## Assumptions

Assumptions made during planning. Flag if any are incorrect.

- **A1**: Moneda = USD. El PDF fuente usa el símbolo "$" sin especificar. Si es incorrecto, es una corrección de un solo campo (`Service.currency`), no un cambio de esquema.
- **A2**: Los servicios de uñas que Yez no realiza (todo excepto Polygel/Rubber Gel/extensión Polygel) son cubiertos por Tania y Mariangely, inferido de "manos y pies, todos los servicios de uñas disponibles". Si es incorrecto, es una edición en `SpecialistService` desde el panel admin.
- **A3**: Los especialistas no tienen login individual en v1; toda la visibilidad de horarios/citas es solo para el admin. Si el personal necesita ver su propia agenda, es un rol y journey nuevos para una iteración futura.
- **A4**: Las duraciones por defecto de cada servicio son estimaciones (ver categorías en `design/data_model.md`) a corregir con datos reales; el modelo de datos ya soporta edición por servicio y por especialista sin necesidad de rediseño.
- **A5**: Las clientas no tienen cuenta con contraseña. Se identifican por nombre + teléfono al agendar; el autoservicio de ver/cancelar cita usa teléfono + código de confirmación generado por el sistema, no un login.
- **A6**: Los servicios de cabello "desde" pueden agendarse provisionalmente con estado `pending_confirmation` mientras Aurora evalúa la foto/hace evaluación presencial, en lugar de bloquear el chat de crear cualquier registro de cita.
- **A7**: Los paquetes de depilación láser se registran como citas de sesión individual, no como un sistema formal de venta de paquetes prepagados con seguimiento de créditos.

(Populated during planning with /init-project)
