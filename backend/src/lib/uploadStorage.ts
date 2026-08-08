import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

import { env } from "../config/env";

export const UPLOADS_DIR = path.resolve(process.cwd(), env.UPLOADS_DIR);

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Reference photos only (nail design / hair) — not a general-purpose file upload endpoint.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = EXTENSION_BY_MIME[file.mimetype] ?? "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Tipo de archivo no permitido. Solo se aceptan imágenes JPEG, PNG o WEBP."));
      return;
    }
    cb(null, true);
  },
});
