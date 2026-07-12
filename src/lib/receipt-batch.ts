import type { ReceiptExtractResult } from "@/lib/validation/receipt-extract.schema";

// Persists the bulk-upload queue across navigation into the receipt builder
// and back (a real page navigation, so React state alone won't survive it).
// Raw File objects never go in here — only the serializable extraction
// result, once a file has actually finished being read.
const KEY = "montra:receipt-batch";

export type BatchStatus = "pending" | "extracting" | "matched" | "needsCustomer" | "failed" | "done";

export interface BatchItem {
  id: string;
  fileName: string;
  status: BatchStatus;
  extracted?: ReceiptExtractResult;
  matchedCustomerId?: string;
  matchedCustomerName?: string;
  error?: string;
}

export function loadBatch(): BatchItem[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BatchItem[];
  } catch {
    return [];
  }
}

export function saveBatch(items: BatchItem[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(items));
}

export function clearBatch() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
