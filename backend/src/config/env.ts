import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRATION: z.string().default("24h"),
  CLIENT_SESSION_SECRET: z.string().min(16, "CLIENT_SESSION_SECRET must be at least 16 characters"),
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  // Bootstrap-only fallback: the real Level-3 source of truth is the encrypted Credential
  // vault (see src/lib/ai/apiKey.ts), populated from the admin panel once IT-06/UJ-17 exist.
  OPENAI_API_KEY: z.string().optional(),
  ADMIN_INITIAL_EMAIL: z.string().email().optional(),
  ADMIN_INITIAL_PASSWORD: z.string().optional(),
  CORS_ALLOWED_ORIGIN: z.string().default("http://localhost:5173"),
  UPLOADS_DIR: z.string().default("uploads"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(8),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();
