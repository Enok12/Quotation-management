import { rgb, type PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { ReceiptTemplate } from "./receipt-template";

// ---------- Terms & Conditions content (pages 1–2, drawn before the receipt) ----------
// Faithful transcription of the MONTRA "Terms & Conditions for Customers" document.
// Edit the text here to update the printed terms — layout flows automatically.

type Run = { t: string; b?: boolean };
type Block =
  | { k: "title"; t: string }
  | { k: "heading"; t: string }
  | { k: "bullet"; r: Run[] }
  | { k: "sub"; r: Run[] }
  | { k: "para"; r: Run[] }
  | { k: "rule" }
  | { k: "gap"; h: number };

const p = (t: string): Run => ({ t });
const b = (t: string): Run => ({ t, b: true });
const H = (t: string): Block => ({ k: "heading", t });
const Bul = (...r: Run[]): Block => ({ k: "bullet", r });
const Sub = (...r: Run[]): Block => ({ k: "sub", r });
const gap = (h: number): Block => ({ k: "gap", h });

// Every tenant business gets the same boilerplate terms, with their own name
// substituted in place of a fixed company name — hence these are builders
// parametrized by `name`, not static arrays.
const buildPage1 = (name: string): Block[] => [
  { k: "title", t: "Terms & Conditions for Customers" },

  H("1. Orders"),
  Bul(p("All orders must be confirmed in writing (via email, WhatsApp, or purchase order form).")),
  Bul(p("Minimum Order Quantities (MOQs) may apply depending on the product line.")),
  Bul(p("Custom designs based on images/samples will be accepted after mutual agreement on fabric, size, and finish.")),
  gap(4),

  H("2. Prices & Payments"),
  Bul(p("Prices are quoted on a wholesale basis and may vary based on fabric, quantity, and design complexity.")),
  Bul(p("Payment terms:")),
  Sub(b("60% advance"), p("upon order confirmation.")),
  Sub(b("Balance 40%"), p("upon completion, before delivery/shipping.")),
  Sub(b("Full payment"), p("should be made for the samples")),
  Sub(b("Pattern Making/Grading"), p("full amount should be paid")),
  Bul(p("Payments must be made via [Bank Transfer / Cash / Other accepted methods].")),
  gap(4),

  H("3. Production Timelines"),
  Bul(p("Production lead times depend on order size and design complexity.")),
  Bul(p("Delivery dates will be agreed upon at the time of order confirmation.")),
  Bul(p("Delays caused by fabric availability or customer changes in design/size will extend delivery timelines.")),
  gap(4),

  H("4. Delivery & Shipping"),
  Bul(p("Local deliveries within Sri Lanka are made via courier or pickup at our workshop.")),
  Bul(p("For international customers, shipping charges and customs clearance are the buyer's responsibility.")),
  Bul(p("Risk of loss or damage passes to the customer once goods are handed over to courier/shipping provider.")),
  gap(4),

  H("5. Quality & Defects"),
  Bul(p(`${name} ensures garments meet agreed specifications and undergo Quality Control (QC).`)),
  Bul(p("If defects are found, the customer must report within"), b("7 days"), p("of receiving goods.")),
  Bul(p("Accepted defective items will either be"), b("replaced, repaired, or refunded"), p(`(at ${name}'s discretion).`)),
  Bul(p("Slight variations in color, stitching, or size (within ±1 inch) are industry-accepted tolerances and not considered defects.")),
];

const buildPage2 = (name: string): Block[] => [
  H("6. Returns & Exchanges"),
  Bul(p("Custom orders based on specific samples/images are"), b("non-returnable.")),
  Bul(p("Standard wholesale items may be exchanged if unused, unwashed, and in original packaging within"), b("7 days"), p("of delivery.")),
  Bul(p("Shipping costs for returns/exchanges are borne by the customer.")),
  gap(4),

  H("7. Intellectual Property & Confidentiality"),
  Bul(p(`Designs provided by the customer remain their property. ${name} will not reproduce or sell such designs to other clients without permission.`)),
  Bul(p(`${name}'s own designs, branding, and labels remain the property of the company.`)),
  gap(4),

  H("8. Limitation of Liability"),
  Bul(p(`${name} shall not be liable for any indirect, incidental, or consequential damages (loss of profit, resale issues, delays caused by courier, etc.).`)),
  Bul(p("Liability is strictly limited to the value of the defective goods supplied.")),
  gap(16),

  { k: "rule" },
  { k: "para", r: [p("By placing an order, you acknowledge that you have read, understood, and agree to the above Terms and Conditions.")] },
];

interface Fonts { reg: PDFFont; bold: PDFFont }
const INK = rgb(0.07, 0.07, 0.07);
const BODY = 10;
const LINE_GAP = 3.5;

/** Draw runs with inline bold + word-wrap. Returns the y position after the last line. */
function drawRich(page: PDFPage, runs: Run[], x: number, y: number, maxW: number, size: number, fonts: Fonts): number {
  const spaceW = fonts.reg.widthOfTextAtSize(" ", size);
  const words = runs.flatMap((r) =>
    r.t.split(" ").filter(Boolean).map((w) => ({ w, b: !!r.b })),
  );

  let line: { w: string; b: boolean }[] = [];
  let lineW = 0;
  let yy = y;

  const flush = () => {
    let cx = x;
    for (const { w, b: isBold } of line) {
      const f = isBold ? fonts.bold : fonts.reg;
      page.drawText(w, { x: cx, y: yy, size, font: f, color: INK });
      cx += f.widthOfTextAtSize(w, size) + spaceW;
    }
    yy -= size + LINE_GAP;
    line = [];
    lineW = 0;
  };

  for (const { w, b: isBold } of words) {
    const f = isBold ? fonts.bold : fonts.reg;
    const ww = f.widthOfTextAtSize(w, size);
    const add = line.length ? spaceW + ww : ww;
    if (lineW + add > maxW && line.length) {
      flush();
      line = [{ w, b: isBold }];
      lineW = ww;
    } else {
      line.push({ w, b: isBold });
      lineW += add;
    }
  }
  if (line.length) flush();
  return yy;
}

function drawBlocks(page: PDFPage, blocks: Block[], fonts: Fonts, template: ReceiptTemplate, startY: number): number {
  const M = template.margin;
  const leftX = M + 26;
  const fullW = template.page.width - leftX - (M + 26);
  let y = startY;

  for (const blk of blocks) {
    switch (blk.k) {
      case "gap":
        y -= blk.h;
        break;
      case "title": {
        const tw = fonts.bold.widthOfTextAtSize(blk.t, 12.5);
        page.drawText(blk.t, { x: leftX + (fullW - tw) / 2, y, size: 12.5, font: fonts.bold, color: INK });
        y -= 12.5 + 14;
        break;
      }
      case "heading":
        y -= 5;
        page.drawText(blk.t, { x: leftX, y, size: 11, font: fonts.bold, color: INK });
        y -= 11 + 7;
        break;
      case "rule":
        y -= 4;
        page.drawLine({ start: { x: leftX, y }, end: { x: leftX + fullW, y }, thickness: 0.8, color: template.colors.border });
        y -= 12;
        break;
      case "para":
        y = drawRich(page, blk.r, leftX, y, fullW, BODY, fonts);
        y -= 6;
        break;
      case "bullet":
        page.drawText("•", { x: leftX + 10, y, size: BODY, font: fonts.reg, color: INK });
        y = drawRich(page, blk.r, leftX + 24, y, fullW - 24, BODY, fonts);
        y -= 4;
        break;
      case "sub":
        page.drawText("o", { x: leftX + 34, y, size: 9, font: fonts.reg, color: INK });
        y = drawRich(page, blk.r, leftX + 48, y, fullW - 48, BODY, fonts);
        y -= 3;
        break;
    }
  }
  return y;
}

function decorate(page: PDFPage, template: ReceiptTemplate) {
  const { width: W, height: H } = template.page;
  const M = template.margin;
  page.drawRectangle({ x: M, y: M, width: W - M * 2, height: H - M * 2, borderColor: template.colors.border, borderWidth: 1.4 });
}

/**
 * Append the two Terms & Conditions pages to `doc`. Call this BEFORE adding the
 * receipt page so the final document is: page 1–2 = terms, page 3 = receipt.
 *
 * `businessName` is substituted for every company-name mention in the terms
 * text — each tenant gets the same boilerplate under their own name, not
 * MONTRA's (MONTRA is the software provider, not the party to the contract).
 */
export function drawTermsPages(
  doc: PDFDocument,
  fonts: Fonts,
  logo: PDFImage | null,
  template: ReceiptTemplate,
  businessName: string,
): { page1EndY: number; page2EndY: number } {
  const { width: W, height: H } = template.page;

  // Page 1 — logo (or business name, if no logo) at top, then sections 1–5
  const p1 = doc.addPage([W, H]);
  decorate(p1, template);
  let y = H - 64;
  if (logo) {
    const lw = 170, lh = (logo.height / logo.width) * lw;
    p1.drawImage(logo, { x: (W - lw) / 2, y: y - lh, width: lw, height: lh });
    y -= lh + 14;
  } else {
    const tw = fonts.bold.widthOfTextAtSize(businessName, 20);
    p1.drawText(businessName, { x: (W - tw) / 2, y: y - 20, size: 20, font: fonts.bold, color: INK });
    y -= 20 + 18;
  }
  const page1EndY = drawBlocks(p1, buildPage1(businessName), fonts, template, y);

  // Page 2 — sections 6–8 + closing
  const p2 = doc.addPage([W, H]);
  decorate(p2, template);
  const page2EndY = drawBlocks(p2, buildPage2(businessName), fonts, template, H - 64);

  return { page1EndY, page2EndY };
}
