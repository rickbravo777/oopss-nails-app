import fs from "node:fs";

import { Router } from "express";

import { getOpenAIApiKey } from "../../lib/ai/apiKey";
import { prisma } from "../../lib/prisma";
import { UPLOADS_DIR } from "../../lib/uploadStorage";

export const dashboardRouter = Router();

async function checkDb(): Promise<"ok" | "error"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

// A lightweight configuration check, not a live API call — pinging OpenAI on every
// dashboard load would cost quota/money for no real benefit at this app's scale.
async function checkOpenAI(): Promise<"ok" | "not_configured"> {
  try {
    await getOpenAIApiKey();
    return "ok";
  } catch {
    return "not_configured";
  }
}

function diskUsagePercent(): number | null {
  try {
    const stats = fs.statfsSync(UPLOADS_DIR);
    const used = stats.blocks - stats.bfree;
    return Math.round((used / stats.blocks) * 100);
  } catch {
    return null;
  }
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

dashboardRouter.get("/health", async (_req, res, next) => {
  try {
    const [db, openai, openEscalationsCount, recentErrors, todayAppointments] = await Promise.all([
      checkDb(),
      checkOpenAI(),
      prisma.escalationFlag.count({ where: { status: "open" } }),
      prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.appointment.findMany({
        where: { date: todayDateOnly() },
        include: {
          client: { select: { name: true, phone: true } },
          specialist: { select: { id: true, name: true } },
          services: { include: { service: { select: { name: true } } }, orderBy: { order: "asc" } },
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    res.json({
      db,
      openai,
      diskUsagePercent: diskUsagePercent(),
      openEscalationsCount,
      recentErrors,
      todayAppointments: todayAppointments.map((appt) => ({
        id: appt.id,
        startTime: appt.startTime,
        endTime: appt.endTime,
        status: appt.status,
        clientName: appt.client.name,
        clientPhone: appt.client.phone,
        specialist: appt.specialist,
        services: appt.services.map((line) => line.service.name),
      })),
    });
  } catch (err) {
    next(err);
  }
});
