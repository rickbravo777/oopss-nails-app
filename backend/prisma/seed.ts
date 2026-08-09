import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

import { generateConfirmationCode } from "../src/lib/tokens";

const prisma = new PrismaClient();

function addMinutes(startTime: string, minutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

const CATEGORIES = [
  "Manos",
  "Pies",
  "Cabello",
  "Depilación Corporal",
  "Epilación Facial",
  "Cejas",
  "Pestañas",
  "Faciales y Bienestar",
  "Servicios Corporales y Tratamientos",
  "Depilación Láser",
];

interface ServiceSeed {
  category: string;
  name: string;
  priceType: "fixed" | "starting_at" | "range";
  price: number;
  priceMax?: number;
  durationMinutes: number;
  requiresConsultation?: boolean;
  requiresPhoto?: boolean;
  sessionPackageSize?: number;
}

// Prices verified against the source PDF catalog page-by-page during planning (see
// docs/work_log.md, "Verification: price catalog cross-check against source PDF"). Durations
// are estimates per design/data_model.md's category buckets — editable later via the admin
// panel (UJ-13), not exact salon data yet.
const SERVICES: ServiceSeed[] = [
  // Manos
  { category: "Manos", name: "Manicure Regular", priceType: "fixed", price: 15, durationMinutes: 45 },
  { category: "Manos", name: "Manicure Gel", priceType: "fixed", price: 24, durationMinutes: 60 },
  { category: "Manos", name: "Rubber Gel", priceType: "fixed", price: 35, durationMinutes: 75 },
  { category: "Manos", name: "Extensión Polygel", priceType: "fixed", price: 49, durationMinutes: 90 },
  { category: "Manos", name: "Extensión Acrílico", priceType: "fixed", price: 49, durationMinutes: 90 },
  { category: "Manos", name: "Relleno Polygel", priceType: "fixed", price: 40, durationMinutes: 75 },
  { category: "Manos", name: "Relleno Acrílico", priceType: "fixed", price: 40, durationMinutes: 75 },
  { category: "Manos", name: "Mani Spa (regular)", priceType: "fixed", price: 25, durationMinutes: 60 },
  { category: "Manos", name: "Diseños o Efectos", priceType: "range", price: 10, priceMax: 15, durationMinutes: 15 },

  // Pies
  { category: "Pies", name: "Pedicure Regular", priceType: "fixed", price: 22, durationMinutes: 45 },
  { category: "Pies", name: "Pedicure Gel", priceType: "fixed", price: 30, durationMinutes: 60 },
  { category: "Pies", name: "PediSpa", priceType: "fixed", price: 37, durationMinutes: 60 },
  { category: "Pies", name: "Pintura en gel y PediSpa", priceType: "fixed", price: 52, durationMinutes: 75 },

  // Cabello — "desde" services require Aurora's evaluation (photo or in-person)
  { category: "Cabello", name: "Lavado", priceType: "starting_at", price: 8, durationMinutes: 30, requiresConsultation: true, requiresPhoto: true },
  { category: "Cabello", name: "Corte", priceType: "starting_at", price: 15, durationMinutes: 45, requiresConsultation: true, requiresPhoto: true },
  { category: "Cabello", name: "Blower", priceType: "starting_at", price: 12, durationMinutes: 45, requiresConsultation: true, requiresPhoto: true },
  { category: "Cabello", name: "Peinado", priceType: "starting_at", price: 25, durationMinutes: 60, requiresConsultation: true, requiresPhoto: true },
  { category: "Cabello", name: "Botox", priceType: "fixed", price: 40, durationMinutes: 90 },
  { category: "Cabello", name: "Tratamiento Básico", priceType: "fixed", price: 25, durationMinutes: 45 },
  { category: "Cabello", name: "Tratamiento Intensivo", priceType: "fixed", price: 55, durationMinutes: 90 },
  { category: "Cabello", name: "Tinte", priceType: "starting_at", price: 45, durationMinutes: 150, requiresConsultation: true, requiresPhoto: true },
  { category: "Cabello", name: "Highlights", priceType: "starting_at", price: 75, durationMinutes: 180, requiresConsultation: true, requiresPhoto: true },
  { category: "Cabello", name: "Balayage", priceType: "starting_at", price: 120, durationMinutes: 180, requiresConsultation: true, requiresPhoto: true },
  { category: "Cabello", name: "Alisado Ybera París", priceType: "starting_at", price: 120, durationMinutes: 180, requiresConsultation: true, requiresPhoto: true },

  // Depilación Corporal
  { category: "Depilación Corporal", name: "Depilación de Axila", priceType: "fixed", price: 8, durationMinutes: 15 },
  { category: "Depilación Corporal", name: "Depilación de Bikini", priceType: "fixed", price: 12, durationMinutes: 20 },
  { category: "Depilación Corporal", name: "Depilación de Bikini Full", priceType: "fixed", price: 20, durationMinutes: 30 },
  { category: "Depilación Corporal", name: "Depilación de Glúteos", priceType: "fixed", price: 15, durationMinutes: 20 },
  { category: "Depilación Corporal", name: "Depilación de línea de Ombligo", priceType: "fixed", price: 7, durationMinutes: 10 },
  { category: "Depilación Corporal", name: "Depilación de Media Pierna", priceType: "fixed", price: 15, durationMinutes: 20 },
  { category: "Depilación Corporal", name: "Depilación de Pierna Completa", priceType: "fixed", price: 30, durationMinutes: 30 },
  { category: "Depilación Corporal", name: "Depilación de Brazos", priceType: "fixed", price: 10, durationMinutes: 15 },

  // Epilación Facial
  { category: "Epilación Facial", name: "Epilación de Bozo con cera", priceType: "fixed", price: 3, durationMinutes: 10 },
  { category: "Epilación Facial", name: "Epilación de Bozo con hilo", priceType: "fixed", price: 4, durationMinutes: 10 },
  { category: "Epilación Facial", name: "Epilación de Mentón", priceType: "range", price: 3, priceMax: 6, durationMinutes: 10 },
  { category: "Epilación Facial", name: "Epilación de Patilla", priceType: "fixed", price: 4, durationMinutes: 10 },
  { category: "Epilación Facial", name: "Epilación de Frente", priceType: "fixed", price: 4, durationMinutes: 10 },
  { category: "Epilación Facial", name: "Epilación de Nariz", priceType: "fixed", price: 5, durationMinutes: 10 },
  { category: "Epilación Facial", name: "Epilación de Oído", priceType: "fixed", price: 5, durationMinutes: 10 },
  { category: "Epilación Facial", name: "Epilación de Rostro Completo", priceType: "fixed", price: 15, durationMinutes: 30 },

  // Cejas
  { category: "Cejas", name: "Epilación con Cera o con Hilo", priceType: "fixed", price: 8, durationMinutes: 15 },
  { category: "Cejas", name: "Epilación con Cera o con Hilo + Pintura", priceType: "fixed", price: 10, durationMinutes: 20 },
  { category: "Cejas", name: "Laminado de Cejas", priceType: "fixed", price: 25, durationMinutes: 45 },
  { category: "Cejas", name: "Laminado de Cejas + Pintura", priceType: "fixed", price: 28, durationMinutes: 45 },

  // Pestañas
  { category: "Pestañas", name: "Lifting de Pestañas", priceType: "fixed", price: 28, durationMinutes: 60 },
  { category: "Pestañas", name: "Lifting de Pestañas + Pintura", priceType: "fixed", price: 30, durationMinutes: 60 },
  { category: "Pestañas", name: "Pestañas por Punto", priceType: "fixed", price: 15, durationMinutes: 30 },
  { category: "Pestañas", name: "Pestañas Set Clásico", priceType: "fixed", price: 28, durationMinutes: 90 },
  { category: "Pestañas", name: "Pestañas Set Clásico Full", priceType: "fixed", price: 30, durationMinutes: 100 },
  { category: "Pestañas", name: "Pestañas Efecto Hawaiano", priceType: "fixed", price: 30, durationMinutes: 100 },
  { category: "Pestañas", name: "Pestañas Efecto Rímel", priceType: "fixed", price: 32, durationMinutes: 100 },
  { category: "Pestañas", name: "Pestañas Set 2D", priceType: "fixed", price: 35, durationMinutes: 110 },
  { category: "Pestañas", name: "Pestañas con Volumen", priceType: "starting_at", price: 40, durationMinutes: 120 },

  // Faciales y Bienestar
  { category: "Faciales y Bienestar", name: "Limpieza Facial Profunda", priceType: "fixed", price: 45, durationMinutes: 60 },
  { category: "Faciales y Bienestar", name: "Renovación Celular", priceType: "fixed", price: 40, durationMinutes: 60 },
  { category: "Faciales y Bienestar", name: "Piel Luminosa: Vitamina C + Dermapen", priceType: "fixed", price: 45, durationMinutes: 60 },
  { category: "Faciales y Bienestar", name: "Piel Luminosa: Radiofrecuencia", priceType: "fixed", price: 35, durationMinutes: 45 },

  // Servicios Corporales y Tratamientos
  { category: "Servicios Corporales y Tratamientos", name: "Espalda relajación", priceType: "fixed", price: 45, durationMinutes: 45 },
  { category: "Servicios Corporales y Tratamientos", name: "Piernas cansadas", priceType: "fixed", price: 35, durationMinutes: 45 },
  { category: "Servicios Corporales y Tratamientos", name: "Masaje anti-estrés (en silla)", priceType: "fixed", price: 25, durationMinutes: 30 },
  { category: "Servicios Corporales y Tratamientos", name: "PDRN (Salmón) + Exosomas", priceType: "fixed", price: 60, durationMinutes: 60 },
  { category: "Servicios Corporales y Tratamientos", name: "Exosomas para Cabello", priceType: "fixed", price: 50, durationMinutes: 45 },
  { category: "Servicios Corporales y Tratamientos", name: "Cauterización (Plasma Pen) 1-5", priceType: "fixed", price: 25, durationMinutes: 30 },
  { category: "Servicios Corporales y Tratamientos", name: "Cauterización (Plasma Pen) 6-10", priceType: "fixed", price: 30, durationMinutes: 40 },

  // Depilación Láser — paquetes de 6 sesiones
  { category: "Depilación Láser", name: "Zona S (paquete 6 sesiones)", priceType: "fixed", price: 75, durationMinutes: 20, sessionPackageSize: 6 },
  { category: "Depilación Láser", name: "Zona M (paquete 6 sesiones)", priceType: "fixed", price: 175, durationMinutes: 25, sessionPackageSize: 6 },
  { category: "Depilación Láser", name: "Zona L (paquete 6 sesiones)", priceType: "fixed", price: 225, durationMinutes: 30, sessionPackageSize: 6 },
  { category: "Depilación Láser", name: "Zona XL (paquete 6 sesiones)", priceType: "fixed", price: 245, durationMinutes: 30, sessionPackageSize: 6 },
];

interface SpecialistSeed {
  name: string;
  bio: string;
  services: string[]; // Service names — must match SERVICES above exactly, or a category shorthand below
  categories?: string[]; // Assign every active service in these categories
  schedule: { dayOfWeek: number; startTime: string; endTime: string }[];
  constraints?: { dayOfWeek?: number; serviceNames?: string[]; latestStartTime: string; note: string }[];
}

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const SATURDAY = 6;

const SPECIALISTS: SpecialistSeed[] = [
  {
    name: "Yez",
    bio: "Especialista en uñas — Polygel y Rubber Gel.",
    services: ["Rubber Gel", "Extensión Polygel", "Relleno Polygel"],
    schedule: [
      ...WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "19:00" })),
      { dayOfWeek: SATURDAY, startTime: "09:00", endTime: "17:00" },
    ],
  },
  {
    name: "Tania",
    bio: "Especialista en manos y pies — todos los servicios de uñas.",
    services: [],
    categories: ["Manos", "Pies"],
    schedule: [
      ...WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "18:30" })),
      { dayOfWeek: SATURDAY, startTime: "09:00", endTime: "16:30" },
    ],
    constraints: [{ dayOfWeek: SATURDAY, latestStartTime: "16:00", note: "Último servicio sábados 4:00pm" }],
  },
  {
    name: "Mariangely",
    bio: "Especialista en manos y pies — todos los servicios de uñas.",
    services: [],
    categories: ["Manos", "Pies"],
    schedule: [
      ...WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "18:30" })),
      { dayOfWeek: SATURDAY, startTime: "09:00", endTime: "16:30" },
    ],
    constraints: [{ dayOfWeek: SATURDAY, latestStartTime: "16:00", note: "Último servicio sábados 4:00pm" }],
  },
  {
    name: "Aurora",
    bio: "Estilista — cabello.",
    services: [],
    categories: ["Cabello"],
    schedule: [
      ...WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "18:30" })),
      { dayOfWeek: SATURDAY, startTime: "09:00", endTime: "16:30" },
    ],
    constraints: [
      {
        serviceNames: ["Tinte", "Highlights", "Balayage", "Alisado Ybera París", "Botox", "Tratamiento Intensivo"],
        latestStartTime: "16:30",
        note: "Procesos largos (tintes, mechas, alisados, etc.)",
      },
    ],
  },
  {
    name: "Ana María",
    bio: "Especialista en pestañas. También cejas y depilación facial con hilo o cera.",
    services: [],
    categories: ["Pestañas", "Cejas", "Epilación Facial"],
    schedule: [
      ...WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "11:00", endTime: "18:30" })),
      { dayOfWeek: SATURDAY, startTime: "11:00", endTime: "16:30" },
    ],
  },
  {
    name: "Sonia",
    bio: "Esteticista — faciales, depilación corporal, depilación láser, bienestar.",
    services: [],
    categories: ["Faciales y Bienestar", "Servicios Corporales y Tratamientos", "Depilación Corporal", "Depilación Láser"],
    schedule: [
      ...WEEKDAYS.map((d) => ({ dayOfWeek: d, startTime: "09:00", endTime: "18:30" })),
      { dayOfWeek: SATURDAY, startTime: "09:00", endTime: "16:30" },
    ],
  },
];

// Ambiguous between hands/feet (per the source system-prompt doc), so each colloquial term
// gets two rows — the assistant picks the right one based on whether the client said
// "manos" or "pies" (see buildSystemPrompt, which groups these by term for the model).
const TERM_SYNONYMS: { term: string; serviceName: string }[] = [
  { term: "pintura en gel", serviceName: "Manicure Gel" },
  { term: "pintura en gel", serviceName: "Pedicure Gel" },
  { term: "esmalte semipermanente", serviceName: "Manicure Gel" },
  { term: "esmalte semipermanente", serviceName: "Pedicure Gel" },
  { term: "semipermanente", serviceName: "Manicure Gel" },
  { term: "semipermanente", serviceName: "Pedicure Gel" },
  { term: "peinado para matrimonio", serviceName: "Peinado" },
  { term: "peinado de novia", serviceName: "Peinado" },
  { term: "peinado de boda", serviceName: "Peinado" },
  { term: "peinado para eventos", serviceName: "Peinado" },
  { term: "peinado de quince años", serviceName: "Peinado" },
];

async function main() {
  console.log("Seeding service categories...");
  const categoriesByName = new Map<string, { id: string }>();
  for (const [index, name] of CATEGORIES.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: { name },
      update: { displayOrder: index },
      create: { name, displayOrder: index },
    });
    categoriesByName.set(name, category);
  }

  console.log(`Seeding ${SERVICES.length} services...`);
  const servicesByName = new Map<string, { id: string; categoryId: string }>();
  for (const [index, s] of SERVICES.entries()) {
    const category = categoriesByName.get(s.category);
    if (!category) throw new Error(`Unknown category "${s.category}" for service "${s.name}"`);
    const service = await prisma.service.upsert({
      where: { name: s.name },
      update: {
        priceType: s.priceType,
        price: s.price,
        priceMax: s.priceMax,
        defaultDurationMinutes: s.durationMinutes,
        requiresConsultation: s.requiresConsultation ?? false,
        requiresPhoto: s.requiresPhoto ?? false,
        sessionPackageSize: s.sessionPackageSize,
        sortOrder: index,
      },
      create: {
        categoryId: category.id,
        name: s.name,
        priceType: s.priceType,
        price: s.price,
        priceMax: s.priceMax,
        defaultDurationMinutes: s.durationMinutes,
        requiresConsultation: s.requiresConsultation ?? false,
        requiresPhoto: s.requiresPhoto ?? false,
        sessionPackageSize: s.sessionPackageSize,
        sortOrder: index,
      },
    });
    servicesByName.set(s.name, service);
  }

  console.log(`Seeding ${SPECIALISTS.length} specialists...`);
  for (const sp of SPECIALISTS) {
    const specialist = await prisma.specialist.upsert({
      where: { name: sp.name },
      update: { bio: sp.bio },
      create: { name: sp.name, bio: sp.bio },
    });

    const serviceNames = new Set(sp.services);
    for (const catName of sp.categories ?? []) {
      for (const s of SERVICES) {
        if (s.category === catName) serviceNames.add(s.name);
      }
    }

    for (const name of serviceNames) {
      const service = servicesByName.get(name);
      if (!service) throw new Error(`Unknown service "${name}" assigned to specialist "${sp.name}"`);
      await prisma.specialistService.upsert({
        where: { specialistId_serviceId: { specialistId: specialist.id, serviceId: service.id } },
        update: {},
        create: { specialistId: specialist.id, serviceId: service.id },
      });
    }

    await prisma.scheduleRule.deleteMany({ where: { specialistId: specialist.id } });
    for (const rule of sp.schedule) {
      await prisma.scheduleRule.create({
        data: {
          specialistId: specialist.id,
          dayOfWeek: rule.dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
        },
      });
    }

    await prisma.scheduleConstraint.deleteMany({ where: { specialistId: specialist.id } });
    for (const c of sp.constraints ?? []) {
      if (c.serviceNames) {
        for (const name of c.serviceNames) {
          const service = servicesByName.get(name);
          if (!service) throw new Error(`Unknown service "${name}" in constraint for "${sp.name}"`);
          await prisma.scheduleConstraint.create({
            data: {
              specialistId: specialist.id,
              serviceId: service.id,
              dayOfWeek: c.dayOfWeek,
              latestStartTime: c.latestStartTime,
              note: c.note,
            },
          });
        }
      } else {
        await prisma.scheduleConstraint.create({
          data: {
            specialistId: specialist.id,
            dayOfWeek: c.dayOfWeek,
            latestStartTime: c.latestStartTime,
            note: c.note,
          },
        });
      }
    }
  }

  console.log("Seeding term synonyms...");
  await prisma.termSynonym.deleteMany({ where: { term: { in: [...new Set(TERM_SYNONYMS.map((t) => t.term))] } } });
  for (const t of TERM_SYNONYMS) {
    const service = servicesByName.get(t.serviceName);
    if (!service) throw new Error(`Unknown service "${t.serviceName}" for term synonym "${t.term}"`);
    await prisma.termSynonym.create({
      data: { term: t.term, canonicalServiceId: service.id },
    });
  }

  const adminEmail = process.env.ADMIN_INITIAL_EMAIL;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (adminEmail && adminPassword) {
    console.log(`Seeding initial admin user (${adminEmail})...`);
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: {},
      create: { name: "Admin", email: adminEmail, passwordHash },
    });
  } else {
    console.log("ADMIN_INITIAL_EMAIL/PASSWORD not set — skipping admin user seed.");
  }

  // ── Demo data (pre-delivery pass) ───────────────────────────────────────
  // Realistic-looking clients/appointments/conversations/escalations/policy so every
  // admin and public page has something to render out of the box. Deliberately fake
  // phone numbers (809-555-10xx block) and fixed session tokens so this is idempotent
  // (safe to re-run) and easy to identify as demo content, not real client data.

  console.log("Seeding demo clients...");
  const demoClientSeeds = [
    { name: "Estela Vargas", phone: "8095551001" },
    { name: "Rosa Familia", phone: "8095551002" },
    { name: "Carla Núñez", phone: "8095551003" },
    { name: "Marisol Peña", phone: "8095551004" },
    { name: "Yolanda Reyes", phone: "8095551005" },
  ];
  const demoClientsByPhone = new Map<string, { id: string }>();
  for (const c of demoClientSeeds) {
    const client = await prisma.client.upsert({
      where: { phone: c.phone },
      update: { name: c.name },
      create: { name: c.name, phone: c.phone },
    });
    demoClientsByPhone.set(c.phone, client);
  }

  console.log("Seeding demo appointments...");
  interface DemoAppointmentSeed {
    clientPhone: string;
    specialistName: string;
    serviceName: string;
    date: string; // YYYY-MM-DD
    startTime: string;
    status: "pending_confirmation" | "confirmed" | "cancelled" | "completed" | "no_show";
  }
  // Dates are relative to this pass being run on/around 2026-08-04 (a Tuesday) — a mix of
  // past (completed/no_show/cancelled) and upcoming (confirmed/pending_confirmation) so
  // every status and the dashboard's "citas de hoy" widget all have real data to show.
  const DEMO_APPOINTMENTS: DemoAppointmentSeed[] = [
    { clientPhone: "8095551001", specialistName: "Yez", serviceName: "Rubber Gel", date: "2026-07-28", startTime: "10:00", status: "completed" },
    { clientPhone: "8095551002", specialistName: "Tania", serviceName: "Manicure Gel", date: "2026-07-30", startTime: "11:00", status: "no_show" },
    { clientPhone: "8095551003", specialistName: "Ana María", serviceName: "Lifting de Pestañas", date: "2026-07-29", startTime: "12:00", status: "cancelled" },
    { clientPhone: "8095551004", specialistName: "Sonia", serviceName: "Limpieza Facial Profunda", date: "2026-08-04", startTime: "15:00", status: "confirmed" },
    { clientPhone: "8095551005", specialistName: "Mariangely", serviceName: "Pedicure Gel", date: "2026-08-06", startTime: "10:00", status: "confirmed" },
    { clientPhone: "8095551001", specialistName: "Aurora", serviceName: "Balayage", date: "2026-08-07", startTime: "10:00", status: "pending_confirmation" },
    { clientPhone: "8095551002", specialistName: "Tania", serviceName: "Pedicure Regular", date: "2026-08-08", startTime: "10:00", status: "confirmed" },
  ];
  const specialistsByName = new Map<string, { id: string; services: { serviceId: string; durationOverrideMinutes: number | null }[] }>();
  for (const sp of SPECIALISTS) {
    const specialist = await prisma.specialist.findUniqueOrThrow({
      where: { name: sp.name },
      include: { services: true },
    });
    specialistsByName.set(sp.name, specialist);
  }
  for (const a of DEMO_APPOINTMENTS) {
    const client = demoClientsByPhone.get(a.clientPhone);
    const specialist = specialistsByName.get(a.specialistName);
    const service = servicesByName.get(a.serviceName);
    if (!client || !specialist || !service) {
      throw new Error(`Demo appointment references unknown client/specialist/service: ${JSON.stringify(a)}`);
    }

    const existing = await prisma.appointment.findFirst({
      where: { clientId: client.id, specialistId: specialist.id, date: new Date(`${a.date}T00:00:00Z`), startTime: a.startTime },
    });
    if (existing) continue; // idempotent — already seeded

    const fullService = SERVICES.find((s) => s.name === a.serviceName)!;
    const override = specialist.services.find((ss) => ss.serviceId === service.id)?.durationOverrideMinutes;
    const duration = override ?? fullService.durationMinutes;

    await prisma.appointment.create({
      data: {
        clientId: client.id,
        specialistId: specialist.id,
        date: new Date(`${a.date}T00:00:00Z`),
        startTime: a.startTime,
        endTime: addMinutes(a.startTime, duration),
        status: a.status,
        confirmationCode: generateConfirmationCode(),
        source: "chat",
        services: {
          create: [{ serviceId: service.id, order: 0, durationMinutesSnapshot: duration, priceSnapshot: fullService.price }],
        },
      },
    });
  }

  console.log("Seeding demo conversations + escalations...");
  interface DemoConversationSeed {
    sessionToken: string;
    clientPhone?: string;
    status: "active" | "handed_off" | "closed";
    messages: { role: "user" | "assistant"; content: string }[];
    escalation?: {
      reason: "facial_recommendation" | "laser_zone_confirmation" | "hair_desde_pricing" | "ai_uncertain" | "client_requested_human";
      assignedSpecialistName?: string;
      status: "open" | "resolved";
      resolutionNotes?: string;
    };
  }
  const DEMO_CONVERSATIONS: DemoConversationSeed[] = [
    {
      sessionToken: "demo-session-marisol-facial",
      clientPhone: "8095551004",
      status: "active",
      messages: [
        { role: "user", content: "Hola, ¿cuánto cuesta una Limpieza Facial Profunda?" },
        { role: "assistant", content: "¡Hola! La Limpieza Facial Profunda tiene un precio de $45 y dura aproximadamente 60 minutos. ¿Te gustaría agendarla?" },
      ],
    },
    {
      sessionToken: "demo-session-balayage-duda",
      status: "handed_off",
      messages: [
        { role: "user", content: "Quiero hacerme un balayage pero no sé si me quedaría bien con mi tono de cabello" },
        { role: "assistant", content: "Entiendo tu duda. Para darte una recomendación certera, es mejor que Aurora evalúe tu cabello directamente — te voy a conectar con ella." },
      ],
      escalation: {
        reason: "hair_desde_pricing",
        assignedSpecialistName: "Aurora",
        status: "open",
        resolutionNotes: "Cliente quiere balayage pero necesita evaluación de tono antes de confirmar precio.",
      },
    },
    {
      sessionToken: "demo-session-carla-piel",
      clientPhone: "8095551003",
      status: "closed",
      messages: [
        { role: "user", content: "Tengo la piel muy sensible, ¿qué facial me recomiendan?" },
        { role: "assistant", content: "Para piel sensible es mejor que Sonia evalúe tu caso directamente antes de recomendarte un tratamiento — te voy a conectar con ella." },
      ],
      escalation: {
        reason: "facial_recommendation",
        assignedSpecialistName: "Sonia",
        status: "resolved",
        resolutionNotes: "Se recomendó Limpieza Facial Profunda; cliente agendó su cita.",
      },
    },
  ];
  for (const c of DEMO_CONVERSATIONS) {
    const client = c.clientPhone ? demoClientsByPhone.get(c.clientPhone) : undefined;
    const conversation = await prisma.conversation.upsert({
      where: { sessionToken: c.sessionToken },
      update: { status: c.status },
      create: { sessionToken: c.sessionToken, status: c.status, clientId: client?.id },
    });

    const existingMessages = await prisma.message.count({ where: { conversationId: conversation.id } });
    if (existingMessages === 0) {
      for (const m of c.messages) {
        await prisma.message.create({ data: { conversationId: conversation.id, role: m.role, content: m.content } });
      }
    }

    if (c.escalation) {
      const existingEscalation = await prisma.escalationFlag.findFirst({ where: { conversationId: conversation.id } });
      if (!existingEscalation) {
        const assignedSpecialist = c.escalation.assignedSpecialistName
          ? specialistsByName.get(c.escalation.assignedSpecialistName)
          : undefined;
        await prisma.escalationFlag.create({
          data: {
            conversationId: conversation.id,
            reason: c.escalation.reason,
            status: c.escalation.status,
            assignedSpecialistId: assignedSpecialist?.id,
            resolutionNotes: c.escalation.resolutionNotes,
            resolvedAt: c.escalation.status === "resolved" ? new Date() : undefined,
          },
        });
      }
    }
  }

  console.log("Seeding demo assistant policy...");
  await prisma.assistantPolicy.upsert({
    where: { key: "politica_cancelaciones" },
    update: {},
    create: {
      key: "politica_cancelaciones",
      value:
        "POLÍTICA DE CANCELACIÓN: las citas pueden cancelarse o reprogramarse sin costo hasta 2 horas antes de la hora agendada. Si la clienta necesita cancelar con menos tiempo de anticipación, indícale amablemente que contacte al salón directamente.",
    },
  });

}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
