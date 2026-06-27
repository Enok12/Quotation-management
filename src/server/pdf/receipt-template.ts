import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { drawTermsPages } from "./terms-page";

// ---------- Template (data-driven; register new templates without touching logic) ----------
export const MONTRA_TEMPLATE = {
  id: "montra-business-receipt",
  page: { width: 595.28, height: 841.89 }, // A4
  margin: 26,
  heading: "BUSINESS RECEIPT",
  colors: {
    ink: rgb(0.07, 0.07, 0.07),
    border: rgb(0.62, 0.62, 0.62),
    cell: rgb(0.78, 0.78, 0.78),
    headerFill: rgb(0.98, 0.83, 0.66),
  },
};
export type ReceiptTemplate = typeof MONTRA_TEMPLATE;

export interface ReceiptPdfData {
  receiptNumber: number | string;
  date: string;
  customer: { name: string; address?: string | null; phone?: string | null; email?: string | null };
  payment: { cash: boolean; card: boolean; bankTransfer: boolean; other: boolean };
  items: { quantity: number; description: string; unitPrice: number; lineTotal: number }[];
  adjustments: { label: string; amount: number }[];
  totalDue: number;
  advanceAmount: number;
  amountPaid: number;
  balance: number;
}
export interface ReceiptAssets { wordmark?: Uint8Array; mark?: Uint8Array }

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n ?? 0);

export async function generateReceiptPdf(
  data: ReceiptPdfData,
  assets: ReceiptAssets = {},
  template: ReceiptTemplate = MONTRA_TEMPLATE,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { width: W, height: H } = template.page;
  const C = template.colors;

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const wordmark = assets.wordmark ? await doc.embedPng(assets.wordmark) : null;
  const mark = assets.mark ? await doc.embedPng(assets.mark) : null;

  // Pages 1–2: Terms & Conditions (drawn first so the receipt is the last page).
  drawTermsPages(doc, { reg: serif, bold: serifBold }, { wordmark, mark }, template);

  // Page 3: the receipt itself.
  const page = doc.addPage([W, H]);

  const M = template.margin;
  const innerL = M + 14, innerR = W - M - 14, contentW = innerR - innerL;

  page.drawRectangle({ x: M, y: M, width: W - M * 2, height: H - M * 2, borderColor: C.border, borderWidth: 1.4 });

  if (mark) {
    const wmW = 360, wmH = (mark.height / mark.width) * wmW;
    page.drawImage(mark, { x: (W - wmW) / 2, y: H / 2 - wmH / 2 + 40, width: wmW, height: wmH, opacity: 0.06 });
  }

  let y = H - M - 30;
  if (wordmark) {
    const lw = 210, lh = (wordmark.height / wordmark.width) * lw;
    page.drawImage(wordmark, { x: (W - lw) / 2, y: y - lh, width: lw, height: lh });
    y -= lh + 22;
  }
  page.drawText(template.heading, { x: innerL, y: y - 24, size: 25, font: serif, color: C.ink });
  y -= 44;
  page.drawText("Date: ", { x: innerL, y, size: 10.5, font: sansBold, color: C.ink });
  page.drawText(data.date, { x: innerL + 32, y, size: 10.5, font: sansBold, color: C.ink });
  y -= 18;
  page.drawText("Receipt #: ", { x: innerL, y, size: 10.5, font: sansBold, color: C.ink });
  page.drawText(String(data.receiptNumber), { x: innerL + 52, y, size: 10.5, font: sansBold, color: C.ink });
  y -= 20;

  // Customer / Payment grid
  const colMid = innerL + contentW / 2, custLabelW = 64, payLabelW = 96, rowH = 26;
  const cust: [string, string | null | undefined][] = [
    ["Name", data.customer.name], ["Address", data.customer.address],
    ["Phone", data.customer.phone], ["Email", data.customer.email],
  ];
  const pay: [string, boolean][] = [
    ["Cash", data.payment.cash], ["Debit/Credit Card", data.payment.card],
    ["Bank Transfer", data.payment.bankTransfer], ["Other", data.payment.other],
  ];
  const tableTop = y, nRows = 4;
  cell(page, C, innerL, tableTop - rowH, colMid - innerL, rowH);
  cell(page, C, colMid, tableTop - rowH, innerR - colMid, rowH);
  center(page, "CUSTOMER DETAILS", innerL, colMid, tableTop - rowH + 8, sansBold, 10, C.ink);
  center(page, "PAYMENT INFORMATION", colMid, innerR, tableTop - rowH + 8, sansBold, 10, C.ink);
  for (let i = 0; i < nRows; i++) {
    const ry = tableTop - rowH * (i + 2);
    cell(page, C, innerL, ry, custLabelW, rowH);
    cell(page, C, innerL + custLabelW, ry, colMid - innerL - custLabelW, rowH);
    page.drawText(cust[i][0], { x: innerL + 6, y: ry + 8, size: 9.5, font: sansBold, color: C.ink });
    wrap(page, cust[i][1] ?? "", innerL + custLabelW + 6, ry + 8, colMid - innerL - custLabelW - 12, sans, 9.5, C.ink);
    cell(page, C, colMid, ry, payLabelW, rowH);
    cell(page, C, colMid + payLabelW, ry, innerR - colMid - payLabelW, rowH);
    page.drawText(pay[i][0], { x: colMid + 6, y: ry + 8, size: 9.5, font: sansBold, color: C.ink });
    if (pay[i][1]) page.drawText("X", { x: colMid + payLabelW + 10, y: ry + 7, size: 11, font: sansBold, color: C.ink });
  }
  y = tableTop - rowH * (nRows + 1) - 24;

  // Items table
  const qtyW = 46, totalW = 96, priceW = 110, descW = contentW - qtyW - priceW - totalW, ih = 26;
  const xQty = innerL, xDesc = xQty + qtyW, xPrice = xDesc + descW, xTotal = xPrice + priceW;
  let ry = y - ih;
  for (const [x, w, label, centered] of [
    [xQty, qtyW, "Qty", true], [xDesc, descW, "Description", false],
    [xPrice, priceW, "Unit Price", false], [xTotal, totalW, "Total", false],
  ] as [number, number, string, boolean][]) {
    cell(page, C, x, ry, w, ih, C.headerFill);
    if (centered) center(page, label, x, x + w, ry + 8, sansBold, 9.5, C.ink);
    else page.drawText(label, { x: x + 6, y: ry + 8, size: 9.5, font: sansBold, color: C.ink });
  }
  for (const it of data.items) {
    ry -= ih;
    cell(page, C, xQty, ry, qtyW, ih); cell(page, C, xDesc, ry, descW, ih);
    cell(page, C, xPrice, ry, priceW, ih); cell(page, C, xTotal, ry, totalW, ih);
    center(page, String(it.quantity), xQty, xQty + qtyW, ry + 8, sans, 9.5, C.ink);
    page.drawText(it.description, { x: xDesc + 6, y: ry + 8, size: 9.5, font: sans, color: C.ink });
    page.drawText(`${money(it.unitPrice)} x ${it.quantity}`, { x: xPrice + 6, y: ry + 8, size: 9.5, font: sans, color: C.ink });
    page.drawText(money(it.lineTotal), { x: xTotal + 6, y: ry + 8, size: 9.5, font: sans, color: C.ink });
  }
  const totalsRows: [string, string][] = [
    ...data.adjustments.map((a) => [a.label, money(a.amount)] as [string, string]),
    ["Total Due", money(data.totalDue)],
    ["Advance Amount", money(data.advanceAmount)],
    ["Amount Paid", money(data.amountPaid)],
    ["Balance", money(data.balance)],
  ];
  for (const [label, val] of totalsRows) {
    ry -= ih;
    cell(page, C, xPrice, ry, priceW, ih, C.headerFill); cell(page, C, xTotal, ry, totalW, ih);
    page.drawText(label, { x: xPrice + 6, y: ry + 8, size: 9.5, font: sansBold, color: C.ink });
    page.drawText(val, { x: xTotal + 6, y: ry + 8, size: 9.5, font: sans, color: C.ink });
  }
  return doc.save();
}

type Colors = ReceiptTemplate["colors"];
function cell(page: PDFPage, C: Colors, x: number, y: number, w: number, h: number, fill?: Colors["headerFill"]) {
  if (fill) page.drawRectangle({ x, y, width: w, height: h, color: fill });
  page.drawRectangle({ x, y, width: w, height: h, borderColor: C.cell, borderWidth: 0.8 });
}
function center(page: PDFPage, t: string, x1: number, x2: number, y: number, f: PDFFont, s: number, c: Colors["ink"]) {
  const tw = f.widthOfTextAtSize(t, s);
  page.drawText(t, { x: x1 + (x2 - x1 - tw) / 2, y, size: s, font: f, color: c });
}
function wrap(page: PDFPage, text: string, x: number, y: number, maxW: number, f: PDFFont, s: number, c: Colors["ink"]) {
  let line = "", yy = y;
  for (const w of String(text).split(" ")) {
    const test = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(test, s) > maxW && line) {
      page.drawText(line, { x, y: yy, size: s, font: f, color: c });
      line = w; yy -= s + 2;
    } else line = test;
  }
  if (line) page.drawText(line, { x, y: yy, size: s, font: f, color: c });
}
