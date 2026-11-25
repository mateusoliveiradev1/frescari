import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { sanitizeEnvValue } from "./env";

/**
 * Field-level encryption for personal identifiers (CPF/CNPJ) stored in the
 * database. AES-256-GCM: a database dump, a leaked backup or someone with
 * read access to the tables sees only ciphertext; the key lives only in the
 * app's environment (PII_ENCRYPTION_KEY, 32 random bytes, base64).
 *
 * Stored format: "enc:v1:<iv>:<tag>:<ciphertext>" (base64url parts). Values
 * written before encryption existed are plain digits and are returned as-is
 * by decryptPii, so reads keep working while old rows are being migrated.
 */

const PREFIX = "enc:v1:";

function getKey(keyOverride?: string) {
  const raw = keyOverride ?? sanitizeEnvValue(process.env.PII_ENCRYPTION_KEY);
  if (!raw) {
    throw new Error("PII_ENCRYPTION_KEY is not set.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PII_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  }
  return key;
}

export function isEncryptedPii(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptPii(plain: string, keyOverride?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(keyOverride), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptPii(
  stored: string | null | undefined,
  keyOverride?: string,
): string | null {
  if (stored === null || stored === undefined || stored === "") return null;
  if (!isEncryptedPii(stored)) return stored; // legacy plain value

  const [ivPart, tagPart, dataPart] = stored.slice(PREFIX.length).split(":");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Malformed encrypted value.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(keyOverride),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

// "12345678909" -> "***.456.789-**"; CNPJ "12345678000195" -> "**.***.678/0001-**"
export function maskDocument(digits: string | null | undefined) {
  if (!digits) return null;
  const clean = digits.replace(/\D/g, "");
  if (clean.length === 11) {
    return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
  }
  if (clean.length === 14) {
    return `**.***.${clean.slice(5, 8)}/${clean.slice(8, 12)}-**`;
  }
  return "***";
}
