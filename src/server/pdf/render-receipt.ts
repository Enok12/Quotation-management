import { generateReceiptPdf, type ReceiptAssets, type ReceiptPdfData } from "./receipt-template";
import type { FullReceipt } from "../repositories/receipt.repository";
import { receiptNumberSlug } from "@/lib/utils/receipt-number";

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

// Map a persisted receipt to the PDF engine's input shape. An Unconfirmed
// receipt (receiptNumber null) renders fine too — as a clearly-marked draft,
// see receipt-template.ts — so folder sync has something to place for it.
export async function renderReceiptPdf(r: FullReceipt): Promise<Uint8Array> {
  const data: ReceiptPdfData = {
    businessName: r.business.name,
    // Formatted, not raw: Bulk and Sample are separate sequences, so the
    // printed document has to carry the Sample marker ("S-01") or two
    // different invoices would both read "Receipt #: 1".
    receiptNumber: r.receiptNumber === null ? null : receiptNumberSlug(r.receiptNumber, r.orderType),
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
