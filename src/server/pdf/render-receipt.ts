import { generateReceiptPdf, type ReceiptAssets, type ReceiptPdfData } from "./receipt-template";
import type { FullReceipt } from "../repositories/receipt.repository";

const has = (m: string[], v: string) => m.includes(v);
const num = (d: { toNumber(): number } | number) => (typeof d === "number" ? d : d.toNumber());

// Fetches the tenant's own uploaded logo (if any) for embedding — receipts
// carry the issuing business's brand, not MONTRA's (MONTRA is the software
// provider, not a party to the receipt).
async function fetchLogo(logoUrl: string | null): Promise<ReceiptAssets> {
  if (!logoUrl) return {};
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return {};
    const logo = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "";
    const logoIsPng = contentType.includes("png") || logoUrl.endsWith(".png");
    return { logo, logoIsPng };
  } catch {
    // A transient fetch failure shouldn't block PDF generation — fall back
    // to the business-name text heading instead.
    return {};
  }
}

// Map a persisted receipt to the PDF engine's input shape. Callers must only
// invoke this on a confirmed receipt (receiptNumber assigned) — the
// generate-pdf route enforces that before this is ever reached.
export async function renderReceiptPdf(r: FullReceipt): Promise<Uint8Array> {
  if (r.receiptNumber === null) throw new Error("Cannot render a PDF for an unconfirmed receipt");
  const data: ReceiptPdfData = {
    businessName: r.business.name,
    receiptNumber: r.receiptNumber,
    date: new Intl.DateTimeFormat("en-GB").format(r.date),
    customer: { name: r.custName, address: r.custAddress, phone: r.custPhone, email: r.custEmail },
    payment: {
      cash: has(r.paymentMethods, "CASH"),
      card: has(r.paymentMethods, "CARD"),
      bankTransfer: has(r.paymentMethods, "BANK_TRANSFER"),
      other: has(r.paymentMethods, "OTHER"),
    },
    items: r.items.map((i) => ({
      quantity: i.quantity, description: i.description,
      unitPrice: num(i.unitPrice), lineTotal: num(i.lineTotal),
    })),
    adjustments: r.adjustments.map((a) => ({ label: a.label, amount: num(a.amount) })),
    totalDue: num(r.totalDue),
    advanceAmount: num(r.advanceAmount),
    amountPaid: num(r.amountPaid),
    balance: num(r.balance),
  };
  return generateReceiptPdf(data, await fetchLogo(r.business.logoUrl));
}
