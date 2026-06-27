import fs from "node:fs/promises";
import path from "node:path";
import { generateReceiptPdf, type ReceiptPdfData } from "./receipt-template";
import type { FullReceipt } from "../repositories/receipt.repository";

const has = (m: string[], v: string) => m.includes(v);
const num = (d: { toNumber(): number } | number) => (typeof d === "number" ? d : d.toNumber());

// Cache the brand assets in module scope (read once per cold start).
let assets: { wordmark: Uint8Array; mark: Uint8Array } | null = null;
async function brand() {
  if (assets) return assets;
  const dir = path.join(process.cwd(), "public", "brand");
  assets = {
    wordmark: await fs.readFile(path.join(dir, "montra-wordmark.png")),
    mark: await fs.readFile(path.join(dir, "montra-mark.png")),
  };
  return assets;
}

// Map a persisted receipt to the PDF engine's input shape.
export async function renderReceiptPdf(r: FullReceipt): Promise<Uint8Array> {
  const data: ReceiptPdfData = {
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
  return generateReceiptPdf(data, await brand());
}
