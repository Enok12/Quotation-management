// Short-lived hand-off from the receipt-upload flow to the receipt builder.
// Written by CustomerPickerShell right before navigating to the builder with
// a resolved customerId; read once by ReceiptBuilder on mount, then cleared.
const KEY = "montra:receipt-draft";

export interface ReceiptDraft {
  date: string | null;
  items: { description: string; quantity: number; unitPrice: number }[];
  adjustments: { label: string; amount: number }[];
  advanceAmount: number | null;
  amountPaid: number | null;
  paymentMethods: string[];
}

export function stashReceiptDraft(draft: ReceiptDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function popReceiptDraft(): ReceiptDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as ReceiptDraft;
  } catch {
    return null;
  }
}
