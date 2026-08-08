import { Router } from "express";
import { z } from "zod";

import { decrypt, encrypt, maskSecret } from "../../lib/crypto";
import { prisma } from "../../lib/prisma";

export const credentialsRouter = Router();

// The set of Level-3 credential keys this vault is allowed to store — prevents the admin
// panel from being used to stash arbitrary unrelated secrets (see design/architecture.md).
const KNOWN_CREDENTIAL_KEYS = new Set([
  "OPENAI_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
]);

credentialsRouter.get("/", async (_req, res, next) => {
  try {
    const stored = await prisma.credential.findMany();
    const storedByKey = new Map(stored.map((c) => [c.key, c]));

    const result = [...KNOWN_CREDENTIAL_KEYS].map((key) => {
      const entry = storedByKey.get(key);
      if (!entry) {
        return { key, configured: false, maskedValue: null, updatedAt: null };
      }
      return {
        key,
        configured: true,
        maskedValue: maskSecret(decrypt(entry.encryptedValue)),
        updatedAt: entry.updatedAt,
      };
    });

    res.json({ credentials: result });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  value: z.string().min(1),
});

credentialsRouter.put("/:key", async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!KNOWN_CREDENTIAL_KEYS.has(key)) {
      res.status(404).json({ error: "Clave de credencial desconocida" });
      return;
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const encryptedValue = encrypt(parsed.data.value);
    const updated = await prisma.credential.upsert({
      where: { key },
      update: { encryptedValue, updatedByAdminId: req.admin!.sub },
      create: { key, encryptedValue, updatedByAdminId: req.admin!.sub },
    });

    res.json({
      key: updated.key,
      configured: true,
      maskedValue: maskSecret(parsed.data.value),
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});
