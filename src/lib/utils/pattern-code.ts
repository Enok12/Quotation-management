// The human-facing "Pattern ID". Derived from the uploaded module file's name
// and must be unique per business, so both the value stored at creation and the
// value looked up in the Assign dialog go through the same normalizer —
// otherwise "abc-12" and "ABC-12" could slip past the uniqueness check, or a
// lookup could miss a pattern purely on casing/whitespace.
//
// Trim (ends) + uppercase, and collapse any internal run of whitespace to a
// single space so "SHIRT  A17" and "SHIRT A17" match. Internal characters are
// otherwise preserved. No fixed prefix.
export function normalizePatternCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}

// Turns an uploaded file's name into its Pattern ID: drop the last extension,
// then normalize. "EC 1.mdl" → "EC 1", "ec-2.MDL" → "EC-2", "no-ext" → "NO-EXT".
// A leading dot ("​.mdl") or a name that's only an extension yields "" — the
// caller rejects that as an invalid file name.
export function patternCodeFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  return normalizePatternCode(withoutExt);
}
