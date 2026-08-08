import jwt from "jsonwebtoken";

import { env } from "../config/env";

export interface AdminTokenPayload {
  sub: string;
  email: string;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRATION as jwt.SignOptions["expiresIn"] });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AdminTokenPayload;
}
