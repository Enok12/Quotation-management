// Shared between the Styles upload form and the server-side create route, so
// the client-side check and the authoritative server check never drift.

// Per file. Four files per pattern (optional picture + three attachments)
// means one pattern can cost up to 40MB of Blob storage, so this is
// deliberately tighter than the receipt-upload cap.
export const MAX_PATTERN_FILE_BYTES = 10 * 1024 * 1024; // 10MB

// The three attachments are the DXF/HPGL/RUL cutting files (usually), but a
// pattern maker may send any type — a PDF, a zip, an image — so anything is
// allowed. The optional reference *picture* is separate and must be an image,
// since it's the only one rendered inline as a thumbnail.
export function isAcceptedPatternImage(file: { type: string }): boolean {
  return file.type.startsWith("image/");
}

// The three attachment slots, in order, with their human labels. Kept in one
// place so the form fields, the API, and the display never disagree on which
// slot is DXF/HPGL/RUL. file1→DXF, file2→HPGL, file3→RUL — labels only;
// any file type is still accepted in each.
export const PATTERN_FILE_SLOTS = [
  { field: "file1", label: "DXF" },
  { field: "file2", label: "HPGL" },
  { field: "file3", label: "RUL" },
] as const;
export type PatternFileSlot = (typeof PATTERN_FILE_SLOTS)[number]["field"];
