import type { ReceiptExtractResult } from "@/lib/validation/receipt-extract.schema";

// Persists a bulk-upload queue across navigation into the receipt builder and
// back (a real page navigation, so React state alone won't survive it). Raw
// File objects never go in here — only the serializable extraction result,
// once a file has actually finished being read.
//
// Namespaced by batch kind ("bulk" vs "sample") so an in-progress Bulk-Orders
// queue and an in-progress Sample-Orders queue never overwrite each other.
export type BatchKind = "bulk" | "sample";
const keyFor = (kind: BatchKind) => `montra:receipt-batch:${kind}`;

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

export function loadBatch(kind: BatchKind): BatchItem[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(keyFor(kind));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BatchItem[];
  } catch {
    return [];
  }
}

export function saveBatch(kind: BatchKind, items: BatchItem[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(keyFor(kind), JSON.stringify(items));
}

export function clearBatch(kind: BatchKind) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(keyFor(kind));
}
