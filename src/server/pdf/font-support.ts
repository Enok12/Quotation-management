import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PDFFont } from "pdf-lib";

// The built-in PDF fonts (Helvetica/Times) are WinAnsi-encoded and can only
// represent Latin-1. Drawing anything above U+00FF throws outright
// ("WinAnsi cannot encode ..."), which previously failed the entire PDF for
// any receipt containing Sinhala — breaking the PDF button, folder sync, and
// the bulk-upload save path all at once.
export const needsUnicodeFont = (text: string) => /[^ -ÿ]/.test(text);

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
