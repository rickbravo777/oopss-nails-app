import type { AdminTokenPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export {};
