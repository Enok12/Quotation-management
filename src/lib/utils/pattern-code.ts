import { randomInt } from "node:crypto";

// The human-facing "Pattern ID". Unlike a tracking token (which only ever
// travels as a URL), this gets read aloud, written on paper, and typed by
// hand into the Assign Pattern dialog — so it's short and deliberately
// excludes characters that are easy to confuse when doing that:
//   0/O, 1/I/L, 5/S, 8/B  →  all omitted.
// What's left is 26 unambiguous symbols.
const ALPHABET = "234679ACDEFGHJKMNPQRTUVWXYZ";
const CODE_LENGTH = 6;
export const PATTERN_CODE_PREFIX = "PTN-";

/**
 * Generates a code like "PTN-7K2M9Q". Uniqueness is enforced by the database
 * (@@unique([businessId, patternCode])), not by this function — the caller
 * retries on a collision, same as any other random-key scheme.
 *
 * randomInt (CSPRNG) rather than Math.random: these codes are handed to
 * outside contractors, and a guessable one would let someone enumerate
 * another business's patterns through the lookup endpoint.
 */
export function generatePatternCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return PATTERN_CODE_PREFIX + code;
}

/**
 * Normalizes whatever an admin typed into the lookup box: trims, uppercases,
 * and adds the "PTN-" prefix if they only typed the six characters. Means
 * "7k2m9q", "ptn-7K2M9Q" and "PTN-7K2M9Q " all find the same pattern.
 */
export function normalizePatternCode(input: string): string {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return "";
  return trimmed.startsWith(PATTERN_CODE_PREFIX) ? trimmed : PATTERN_CODE_PREFIX + trimmed;
}
