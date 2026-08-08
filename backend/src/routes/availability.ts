import { Router } from "express";
import { z } from "zod";

import { checkAvailability } from "../lib/availability";

export const availabilityRouter = Router();

const checkSchema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1),
  specialistId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

availabilityRouter.post("/check", async (req, res, next) => {
  try {
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    if (parsed.data.dateTo < parsed.data.dateFrom) {
      res.status(400).json({ error: "dateTo debe ser igual o posterior a dateFrom" });
      return;
    }

    const slots = await checkAvailability(parsed.data);
    res.json({ slots });
  } catch (err) {
    if (err instanceof Error && err.message.includes("no existen o no están activos")) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});
