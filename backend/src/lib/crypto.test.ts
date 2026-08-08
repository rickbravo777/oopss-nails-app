import { describe, expect, it } from "vitest";

import { decrypt, encrypt, maskSecret } from "./crypto";

describe("encrypt/decrypt", () => {
  it("round-trips a plaintext value", () => {
    const encrypted = encrypt("sk-super-secret-value");
    expect(decrypt(encrypted)).toBe("sk-super-secret-value");
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encrypt("same-value");
    const b = encrypt("same-value");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same-value");
    expect(decrypt(b)).toBe("same-value");
  });

  it("throws when the ciphertext has been tampered with", () => {
    const encrypted = encrypt("sk-super-secret-value");
    const [iv, authTag, ciphertext] = encrypted.split(".");
    const tampered = [iv, authTag, ciphertext.slice(0, -2) + "xx"].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on a malformed (non-encrypted) value", () => {
    expect(() => decrypt("not-a-valid-encrypted-value")).toThrow("Malformed encrypted value");
  });
});

describe("maskSecret", () => {
  it("keeps only the first 3 and last 4 characters of a long secret", () => {
    expect(maskSecret("sk-abcdefghijklmnop")).toBe("sk-...mnop");
  });

  it("fully masks very short values instead of leaking most of them", () => {
    expect(maskSecret("short")).toBe("•".repeat(5));
  });
});
