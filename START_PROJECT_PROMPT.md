# Start Project

Replace the placeholder below with your project description, then provide this file to the AI assistant.

---

## Project Description

**Project Name**: Oopss Nails — Asistente Virtual de Agendamiento

**Project Type**: AI assistant + plataforma de agendamiento (web, uso desde PC y móvil vía navegador)

**Description**: Oopss Nails es un salón de belleza que ofrece servicios de manos, pies, cabello, depilación, cejas, pestañas, faciales y tratamientos especializados. El proyecto es una plataforma de agendamiento con un asistente conversacional que:
- Responde dudas sobre servicios, precios y especialistas.
- Identifica qué servicio necesita la clienta, incluso cuando lo describe de forma imprecisa (ej. "quiero hacerme las uñas").
- Guía la conversación hasta agendar una cita real, verificando disponibilidad contra el calendario de cada especialista.

**Key Features**:
- Asistente conversacional (system prompt definido — ver `System_Prompt_Asistente_OopssNails.docx` en la raíz del proyecto padre) que identifica servicio → técnica/especialista → día/hora, en ese orden, sin inventar precios ni disponibilidad.
- Base de conocimiento editable desde panel de administración: servicios, precios, personal, horarios (para que el salón la actualice sin depender de un desarrollador).
- Integración con calendario/agenda en tiempo real por especialista, para no confirmar citas sin disponibilidad real.
- Reconocimiento de equivalencias de términos (ej. "pintura en gel" / "esmalte semipermanente" = Manicure Gel o Pedicure Gel).
- Reglas estrictas por especialista: qué servicios atiende cada quien y sus horarios/restricciones (ver tabla de personal).
- Carga y almacenamiento de fotos (referencia de diseño de uñas, foto de cabello para servicios "desde").
- Historial de conversación por clienta/sesión, accesible desde web y móvil.
- Mecanismo de escalamiento a humano cuando el asistente no tenga certeza (ej. recomendaciones de Sonia en faciales/estética, evaluación de precio de cabello).
- Registro de la cita final (servicio, especialista, fecha, hora, cliente) para seguimiento del salón.
- Panel de administración con gestión de credenciales y visibilidad del ciclo de vida (requerido por CLAUDE.md).

**Users/Roles**:
- Clienta (usa el asistente para informarse y agendar citas).
- Especialistas del salón: Yez (solo manos: Polygel, Rubber Gel, extensión Polygel), Tania y Mariangely (manos y pies, todos los servicios de uñas), Aurora (cabello), Ana María (pestañas, cejas, depilación con hilo/cera), Sonia (faciales, depilación corporal/láser, bienestar).
- Administrador/dueño del salón (gestiona precios, servicios, horarios y credenciales desde el panel admin).

**Integrations**: OpenAI SDK para el motor conversacional (según default de CLAUDE.md). Pendiente de definir: canal(es) de atención (WhatsApp, web propia, Instagram, o varios a la vez — ver sección 12 del documento de referencia).

**Constraints / información pendiente de confirmar con el cliente** (no asumir, confirmar antes de planear en detalle):
- Duración estimada de cada servicio (necesaria para bloquear el calendario correctamente).
- Canal(es) de atención del asistente.
- Política de cancelación, reprogramación y/o depósito o anticipo para agendar.
- Moneda de los precios (el catálogo usa "$"; confirmar si son dólares u otra moneda local).
- Quién realiza la extensión de Acrílico (Yez solo hace extensión de Polygel; se asume que Tania y/o Mariangely cubren acrílico, pero debe confirmarse).

**Fuentes de contexto ya disponibles** (en la carpeta padre del proyecto, `salon_belleza/`):
- `System_Prompt_Asistente_OopssNails.docx` (system prompt completo, base de conocimiento, reglas de negocio, personal, horarios y catálogo de precios).
- `Nuestros servicios Oopss Nails.pdf` (catálogo de precios fuente).

---

## What Happens Next

1. The system enters Planning Mode
2. Requirements are analyzed, questions are asked
3. Architecture, stack, and user journeys are proposed
4. A plan is presented for your approval
5. Only after your approval does implementation begin
