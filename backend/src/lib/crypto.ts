import crypto from "node:crypto";

import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

// ENCRYPTION_KEY is an arbitrary-length secret string (see .env.example); hash it down to a
// stable 32-byte key so AES-256 always gets exactly the key size it requires.
function derivedKey(): Buffer {
  return crypto.createHash("sha256").update(env.ENCRYPTION_KEY).digest();
}

// Output format: base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decrypt(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted value");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

// e.g. "sk-abcd1234efgh" -> "sk-...efgh". Never returns enough of the secret to be useful.
export function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}
