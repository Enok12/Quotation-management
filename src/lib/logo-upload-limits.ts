// Logos get embedded straight into the receipt PDF, and pdf-lib can only
// embed PNG/JPEG (no WEBP, no SVG) — so those are the only formats accepted
// here, not just "any image" like receipt-photo uploads.
export const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3MB

const ACCEPTED_LOGO_TYPES = new Set(["image/png", "image/jpeg"]);

export function isAcceptedLogoFile(file: { type: string }): boolean {
  return ACCEPTED_LOGO_TYPES.has(file.type);
}
