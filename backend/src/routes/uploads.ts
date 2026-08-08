import fs from "node:fs";
import path from "node:path";

import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { env } from "../config/env";
import { verifyAdminToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { uploadLimiter } from "../lib/rateLimiters";
import { UPLOADS_DIR, upload } from "../lib/uploadStorage";
import { requireSessionOrAdmin } from "../middleware/requireSessionOrAdmin";

export const uploadsRouter = Router();

const purposeSchema = z.enum(["nail_reference", "hair_desde_evaluation"]);

uploadsRouter.post("/", requireSessionOrAdmin, uploadLimiter, (req, res, next) => {
  upload.single("file")(req, res, async (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: `El archivo excede el tamaño máximo permitido (${env.MAX_UPLOAD_SIZE_MB}MB).`,
        });
        return;
      }
      const message = err instanceof Error ? err.message : "Archivo inválido";
      res.status(400).json({ error: message });
      return;
    }

    try {
      if (!req.file) {
        res.status(400).json({ error: "No se recibió ningún archivo" });
        return;
      }

      const parsedPurpose = purposeSchema.safeParse(req.body.purpose);
      if (!parsedPurpose.success) {
        fs.unlink(req.file.path, () => {});
        res.status(400).json({ error: "purpose debe ser 'nail_reference' o 'hair_desde_evaluation'" });
        return;
      }

      const photo = await prisma.photoUpload.create({
        data: {
          conversationId: req.conversation?.id,
          clientId: req.conversation?.clientId ?? undefined,
          filePath: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          purpose: parsedPurpose.data,
        },
      });

      res.json({ id: photo.id, filePath: photo.filePath });
    } catch (dbErr) {
      if (req.file) fs.unlink(req.file.path, () => {});
      next(dbErr);
    }
  });
});

uploadsRouter.get("/:id", async (req, res, next) => {
  try {
    const photo = await prisma.photoUpload.findUnique({ where: { id: req.params.id } });
    if (!photo) {
      res.status(404).json({ error: "Archivo no encontrado" });
      return;
    }

    const isOwner = await isAuthorizedForPhoto(req, photo.conversationId);
    if (!isOwner) {
      res.status(404).json({ error: "Archivo no encontrado" });
      return;
    }

    res.sendFile(path.join(UPLOADS_DIR, photo.filePath));
  } catch (err) {
    next(err);
  }
});

async function isAuthorizedForPhoto(
  req: Parameters<Parameters<typeof uploadsRouter.get>[1]>[0],
  conversationId: string | null,
): Promise<boolean> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  if (bearerToken) {
    try {
      verifyAdminToken(bearerToken);
      return true;
    } catch {
      // Not a valid admin token — fall through to session-token ownership check.
    }
  }

  const sessionToken = req.header("X-Session-Token");
  if (!sessionToken || !conversationId) return false;

  const conversation = await prisma.conversation.findUnique({ where: { sessionToken } });
  return conversation?.id === conversationId;
}
