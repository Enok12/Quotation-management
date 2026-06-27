import { randomBytes } from "node:crypto";

// Unguessable URL-safe token for one-time customer invite links.
// 32 bytes of CSPRNG output → ~256 bits, far beyond brute-forceable.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
