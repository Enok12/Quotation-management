import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts small secrets (e.g. a business's own Gemini API key) at rest.
// AES-256-GCM: a fresh random IV per call, auth tag stored alongside so
// tampering is detected on decrypt. Encoded as "iv.authTag.ciphertext",
// each segment base64.
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const b64 = process.env.SECRET_ENCRYPTION_KEY;
  if (!b64) throw new Error("SECRET_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]).toString("utf8");
}
