// Shared between the Styles upload form and the server-side create route, so
// the client-side check and the authoritative server check never drift.

// Per file, applied to both the Module file and the optional picture.
export const MAX_PATTERN_FILE_BYTES = 10 * 1024 * 1024; // 10MB

// The Module (.mdl) file may be any type, so it's never assumed renderable.
// The optional reference *picture* is separate and must be an image, since
// it's the only one rendered inline as a thumbnail.
export function isAcceptedPatternImage(file: { type: string }): boolean {
  return file.type.startsWith("image/");
}

// Form field name for the single Module file, shared by the form and the API.
export const MODULE_FILE_FIELD = "module";
