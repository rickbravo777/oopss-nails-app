import { AppointmentNotReschedulableError, createAppointment, InvalidBookingError, SlotUnavailableError } from "../../booking";
import { prisma } from "../../prisma";
import type { ToolDefinition } from "../types";

interface CreateAppointmentArgs {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  specialistName: string;
  serviceNames: string[];
  date: string;
  startTime: string;
  notes?: string;
}

export const createAppointmentTool: ToolDefinition<CreateAppointmentArgs> = {
  name: "create_appointment",
  description:
    "Crea la cita DEFINITIVA en el sistema. SOLO llama a esta herramienta después de que la clienta haya " +
    "confirmado explícitamente TODOS los detalles (servicio(s), especialista, fecha, hora, y su nombre y " +
    "teléfono) — nunca la llames sin una confirmación explícita de la clienta. Si algo falla (ej. el horario " +
    "ya no está disponible), informa a la clienta con honestidad y ofrécele buscar otro horario.",
  parameters: {
    type: "object",
    properties: {
      clientName: { type: "string", description: "Nombre de la clienta" },
      clientPhone: { type: "string", description: "Teléfono de la clienta" },
      clientEmail: { type: "string", description: "Correo de la clienta, si lo dio (opcional)" },
      specialistName: { type: "string", description: "Nombre exacto de la especialista confirmada" },
      serviceNames: {
        type: "array",
        items: { type: "string" },
        description: "Nombres exactos (del catálogo real) de todos los servicios confirmados",
      },
      date: { type: "string", description: "Fecha confirmada, formato YYYY-MM-DD" },
      startTime: { type: "string", description: "Hora de inicio confirmada, formato HH:mm (24h)" },
      notes: { type: "string", description: "Notas adicionales relevantes, si las hay" },
    },
    required: ["clientName", "clientPhone", "specialistName", "serviceNames", "date", "startTime"],
  },
  handler: async (args) => {
    const specialist = await prisma.specialist.findUnique({ where: { name: args.specialistName } });
    if (!specialist) {
      return { success: false, message: `No se encontró una especialista llamada "${args.specialistName}".` };
    }

    const services = await prisma.service.findMany({ where: { name: { in: args.serviceNames }, active: true } });
    const missing = args.serviceNames.filter((n) => !services.some((s) => s.name === n));
    if (missing.length > 0) {
      return { success: false, message: `No se encontraron estos servicios en el catálogo: ${missing.join(", ")}` };
    }

    try {
      const appointment = await createAppointment({
        clientName: args.clientName,
        clientPhone: args.clientPhone,
        clientEmail: args.clientEmail,
        specialistId: specialist.id,
        date: args.date,
        startTime: args.startTime,
        serviceIds: services.map((s) => s.id),
        notes: args.notes,
        source: "chat",
      });
      return { success: true, appointment };
    } catch (err) {
      if (err instanceof SlotUnavailableError || err instanceof InvalidBookingError || err instanceof AppointmentNotReschedulableError) {
        return { success: false, message: err.message };
      }
      throw err;
    }
  },
};
