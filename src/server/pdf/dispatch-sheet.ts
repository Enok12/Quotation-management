// Same polyfill receipt-template.ts needs before fontkit's Sinhala shaping.
import "regenerator-runtime/runtime.js";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { loadUnicodeFonts, pickFont, normalizePdfText, type FontSet } from "./font-support";

// The printable sheet that goes on / with a COD parcel. It is NOT the
// courier's waybill (the courier issues that); it carries our own dispatch
// reference and, above all, the amount the courier must collect.
export interface DispatchSheetData {
  businessName: string;
  dispatchRef: string;
  courierName: string | null;
  waybillNo: string | null;
  customerName: string;
  customerPhone: string;
  customerPhone2: string | null;
  address: string;
  city: string | null;
  items: { sku: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  itemsTotal: number;
  deliveryFee: number;
  feePaidBy: "CUSTOMER" | "BUSINESS";
  codAmount: number;
  date: string;
}

const money = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n ?? 0);
const t = (s: string) => normalizePdfText(s);

function wrap(text: string, maxW: number, f: PDFFont, size: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    if (!w) continue;
    const test = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(test, size) > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateDispatchSheet(data: DispatchSheetData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const bytes = await loadUnicodeFonts();
  const uni = await doc.embedFont(bytes.regular, { subset: true });
  const uniBold = await doc.embedFont(bytes.bold, { subset: true });
  const fonts: FontSet = { reg: sans, bold: sansBold, uni, uniBold };
  const F = (text: string, bold = false) => pickFont(text, fonts, bold);

  const W = 420, H = 595; // A5 portrait — fits on a parcel
  const M = 28;
  const ink = rgb(0.1, 0.1, 0.1), muted = rgb(0.4, 0.4, 0.4), line = rgb(0.75, 0.75, 0.75);
  let page = doc.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, size: number, bold = false, color = ink) => {
    const clean = t(s);
    page.drawText(clean, { x, y, size, font: F(clean, bold), color });
  };
  const rule = () => { page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: line }); };
  const newPageIfNeeded = (need: number) => {
    if (y - need < M + 20) { page = doc.addPage([W, H]); y = H - M; }
  };

  // Header
  text(data.businessName, M, 14, true); y -= 16;
  text("DISPATCH SHEET", M, 8, true, muted);
  const ref = data.dispatchRef;
  page.drawText(ref, { x: W - M - sansBold.widthOfTextAtSize(ref, 18), y: y + 4, size: 18, font: sansBold, color: ink });
  y -= 10; rule(); y -= 16;

  text(`Date: ${data.date}`, M, 9, false, muted);
  if (data.courierName) { y -= 12; text(`Courier: ${data.courierName}`, M, 9, false, muted); }
  if (data.waybillNo) { y -= 12; text(`Waybill: ${data.waybillNo}`, M, 9, false, muted); }
  y -= 18;

  // Deliver to
  text("DELIVER TO", M, 8, true, muted); y -= 14;
  text(data.customerName, M, 13, true); y -= 16;
  const phones = [data.customerPhone, data.customerPhone2].filter(Boolean).join("  /  ");
  text(phones, M, 11, true); y -= 15;
  const addr = [data.address, data.city].filter(Boolean).join(", ");
  const addrFont = F(addr);
  for (const l of wrap(t(addr), W - 2 * M, addrFont, 10)) {
    page.drawText(l, { x: M, y, size: 10, font: addrFont, color: ink });
    y -= 13;
  }
  y -= 6; rule(); y -= 16;

  // Items
  text("ITEMS", M, 8, true, muted); y -= 14;
  for (const it of data.items) {
    newPageIfNeeded(16);
    const label = t(`${it.sku}  ${it.name}`);
    const lf = F(label);
    const qty = `${it.quantity} x ${money(it.unitPrice)}`;
    page.drawText(label.length > 44 ? label.slice(0, 43) + "…" : label, { x: M, y, size: 9, font: lf, color: ink });
    page.drawText(qty, { x: W - M - sans.widthOfTextAtSize(qty, 9), y, size: 9, font: sans, color: ink });
    y -= 13;
  }
  y -= 4; rule(); y -= 16;
  newPageIfNeeded(120);

  const row = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: M, y, size: 9, font: bold ? sansBold : sans, color: bold ? ink : muted });
    page.drawText(value, { x: W - M - (bold ? sansBold : sans).widthOfTextAtSize(value, 9), y, size: 9, font: bold ? sansBold : sans, color: ink });
    y -= 13;
  };
  row("Items total", money(data.itemsTotal));
  if (data.deliveryFee > 0) {
    row(data.feePaidBy === "CUSTOMER" ? "Delivery fee (paid by customer)" : "Delivery fee (paid by seller)", data.feePaidBy === "CUSTOMER" ? money(data.deliveryFee) : "—");
  }
  y -= 6;

  // The one number the rider must not get wrong.
  const boxH = 56;
  page.drawRectangle({ x: M, y: y - boxH + 14, width: W - 2 * M, height: boxH, borderColor: ink, borderWidth: 1.5 });
  page.drawText("COLLECT ON DELIVERY (LKR)", { x: M + 12, y: y - 4, size: 8, font: sansBold, color: muted });
  const amt = money(data.codAmount);
  page.drawText(amt, { x: M + 12, y: y - 30, size: 26, font: sansBold, color: ink });

  return doc.save();
}
