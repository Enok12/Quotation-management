// Shared between the single-upload flow, the bulk-upload flow, and the
// server-side extract route, so the three never drift out of sync.

// Kept comfortably under Gemini's ~20MB inline-request cap after base64
// inflates the payload by roughly a third.
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12MB

// Caps a single batch so one accidental "select all" can't burn through the
// free-tier daily/per-minute quota in one go.
export const MAX_BATCH_FILES = 20;

export function isAcceptedReceiptFile(file: { type: string }): boolean {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}
