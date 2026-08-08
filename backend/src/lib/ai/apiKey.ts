import { env } from "../../config/env";
import { decrypt } from "../crypto";
import { prisma } from "../prisma";

// Level-3 credential: the salon owner can rotate this from the admin panel (PUT
// /admin/credentials/OPENAI_API_KEY) without a developer — see
// design/architecture.md — Credential Level Mapping. The vault is checked first;
// env.OPENAI_API_KEY is only a bootstrap fallback for local development before any
// value has been set from the admin panel.
export async function getOpenAIApiKey(): Promise<string> {
  const stored = await prisma.credential.findUnique({ where: { key: "OPENAI_API_KEY" } });
  if (stored) {
    return decrypt(stored.encryptedValue);
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "No OpenAI API key configured. Set it from the admin panel (Credentials), or set OPENAI_API_KEY in .env for local development.",
    );
  }
  return env.OPENAI_API_KEY;
}
