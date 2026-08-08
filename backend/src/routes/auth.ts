import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";

import { signAdminToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { loginLimiter } from "../lib/rateLimiters";
import { requireAdminAuth } from "../middleware/requireAdminAuth";

export const authRouter = Router();

// A precomputed hash of a value nobody will ever type, used so bcrypt.compare always runs
// (even for a nonexistent email) — keeps the "unknown email" and "wrong password" paths
// close enough in timing that response time can't be used to enumerate admin accounts.
const DUMMY_HASH = bcrypt.hashSync("no-such-password-will-ever-match-this-dummy-hash", 12);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Solicitud inválida" });
      return;
    }

    const { email, password } = parsed.data;
    const admin = await prisma.adminUser.findUnique({ where: { email } });

    // Same generic message whether the email doesn't exist or the password is wrong, and
    // bcrypt.compare always runs (against a dummy hash when there's no real admin) so the
    // two cases take about the same amount of time — neither leaks which admin accounts exist.
    const passwordMatches = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

    if (!admin || !admin.active || !passwordMatches) {
      res.status(401).json({ error: "Correo o contraseña inválidos" });
      return;
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signAdminToken({ sub: admin.id, email: admin.email });
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAdminAuth, async (req, res, next) => {
  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.sub } });
    if (!admin) {
      res.status(404).json({ error: "Administrador no encontrado" });
      return;
    }
    res.json({ id: admin.id, name: admin.name, email: admin.email });
  } catch (err) {
    next(err);
  }
});
