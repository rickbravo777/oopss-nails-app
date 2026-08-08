import crypto from "node:crypto";

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Excludes visually ambiguous characters (0/O, 1/I/L) since clients read this code aloud
// or type it manually to look up/cancel an appointment.
const CONFIRMATION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateConfirmationCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CONFIRMATION_CODE_ALPHABET[bytes[i] % CONFIRMATION_CODE_ALPHABET.length];
  }
  return code;
}
