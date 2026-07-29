import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PDFFont } from "pdf-lib";

// The built-in PDF fonts (Helvetica/Times) are WinAnsi-encoded and can only
// represent Latin-1. Drawing anything above U+00FF throws outright
// ("WinAnsi cannot encode ..."), which previously failed the entire PDF for
// any receipt containing Sinhala — breaking the PDF button, folder sync, and
// the bulk-upload save path all at once.
export const needsUnicodeFont = (text: string) => /[^ -ÿ]/.test(text);

// Phone keyboards and OCR routinely turn a plain apostrophe into a "smart"
// curly one (U+2019), hyphens into en/em dashes, and so on. Those characters
// sit above U+00FF, so needsUnicodeFont() sent the whole word to the Sinhala
// fallback font — and Latin text drawn through that font's Indic shaping came
// out BLANK. That's exactly why "Men's" vanished from receipts while "Mens"
// rendered fine.
//
// Mapping these typographic variants back to their ASCII equivalents keeps
// such text on the normal Helvetica/Times path, where it renders correctly —
// and they look essentially identical on a printed receipt anyway. Genuine
// non-Latin scripts (e.g. Sinhala) are untouched and still route to the
// Unicode font. Keyed by \u escapes so the mapping never depends on invisible
// bytes surviving an editor round-trip.
const PUNCTUATION_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'", // single quotes / apostrophe / prime
  "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"', // double quotes / double prime
  "–": "-", "—": "-", "―": "-", "−": "-",                 // en/em dash, horizontal bar, minus
  "…": "...",                                                            // ellipsis
  " ": " ", " ": " ", " ": " ", " ": " ",                 // non-breaking / figure / thin / narrow spaces
  "•": "-",                                                              // bullet
  "​": "", "‌": "", "‍": "", "﻿": "",                     // zero-width — drop entirely
};

const PUNCTUATION_RE = new RegExp("[" + Object.keys(PUNCTUATION_MAP).join("") + "]", "g");

/** Fold typographic punctuation to ASCII so it renders in the standard fonts. */
export function normalizePdfText(text: string): string {
  return text.replace(PUNCTUATION_RE, (c) => PUNCTUATION_MAP[c] ?? c);
}

// Font files sit next to this module. process.cwd() rather than import.meta
// so the path resolves the same in dev and in the bundled server build.
const FONT_DIR = path.join(process.cwd(), "src", "server", "pdf", "fonts");

let cached: { regular: Buffer; bold: Buffer } | null = null;

/**
 * Reads the Unicode (Sinhala-capable) faces once per process — they're ~230KB
 * each, and every receipt render would otherwise hit the disk twice.
 */
export async function loadUnicodeFonts(): Promise<{ regular: Buffer; bold: Buffer }> {
  if (!cached) {
    const [regular, bold] = await Promise.all([
      readFile(path.join(FONT_DIR, "NotoSansSinhala-Regular.ttf")),
      readFile(path.join(FONT_DIR, "NotoSansSinhala-Bold.ttf")),
    ]);
    cached = { regular, bold };
  }
  return cached;
}

/** The four faces every draw site chooses between. */
export interface FontSet {
  reg: PDFFont;
  bold: PDFFont;
  uni: PDFFont;
  uniBold: PDFFont;
}

/**
 * Picks the Unicode face only when the standard one would throw on this
 * text, so an all-Latin document keeps its original Times/Helvetica look and
 * only the non-Latin runs switch face.
 */
export function pickFont(text: string, fonts: FontSet, bold = false): PDFFont {
  if (needsUnicodeFont(text)) return bold ? fonts.uniBold : fonts.uni;
  return bold ? fonts.bold : fonts.reg;
}
