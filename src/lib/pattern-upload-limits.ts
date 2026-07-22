// Shared between the Styles upload form and the server-side create route, so
// the client-side check and the authoritative server check never drift.

// Per file. Four files per pattern (optional picture + three mandatory
// attachments) means one pattern can cost up to 40MB of Blob storage, so this
// is deliberately tighter than the receipt-upload cap.
export const MAX_PATTERN_FILE_BYTES = 10 * 1024 * 1024; // 10MB

// The three attachments are usually images, but a pattern maker may also send
// a cutting file (DXF/PLT), a PDF, or a zip — so anything is allowed here.
// The optional reference *picture* is separate and must be an image, since
// it's the only one rendered inline as a thumbnail.
export function isAcceptedPatternImage(file: { type: string }): boolean {
  return file.type.startsWith("image/");
}

export const PATTERN_FILE_SLOTS = ["file1", "file2", "file3"] as const;
export type PatternFileSlot = (typeof PATTERN_FILE_SLOTS)[number];
