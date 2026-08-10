// The human-facing "Pattern ID". It's entered by the pattern maker (not
// generated) and must be unique per business, so both the value stored at
// creation and the value looked up in the Assign dialog go through the same
// normalizer — otherwise "abc-12" and "ABC-12" could slip past the uniqueness
// check, or a lookup could miss a pattern purely on casing/whitespace.
//
// Trim (ends) + uppercase, and collapse any internal run of whitespace to a
// single space so "SHIRT  A17" and "SHIRT A17" match. Internal characters are
// otherwise preserved as typed. No fixed prefix — the pattern maker uses
// whatever scheme they like.
export function normalizePatternCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, " ");
}
