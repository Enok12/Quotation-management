// Single source of truth for which folder a receipt belongs in.
// Used by the in-app Orders section and the computer folder sync.
//
//   BULK order, no invoice number yet → Unconfirmed (no advance paid yet)
//   SAMPLE order                      → Sample Orders (stays here until converted/deleted)
//   BULK order, fully paid            → Completed
//   BULK order, otherwise             → BULK ORDERS (unpaid / advance)
//
// Each receipt also belongs to a top-level category (Men's / Women's), so
// the full on-disk path is <category>/<folder>, e.g. "Men's/BULK ORDERS".

export type FolderKey = "UNCONFIRMED" | "BULK" | "SAMPLE" | "COMPLETED";

// On-disk folder names (also the tab labels).
export const FOLDER_NAMES: Record<FolderKey, string> = {
  UNCONFIRMED: "Unconfirmed",
  BULK: "BULK ORDERS",
  SAMPLE: "Sample Orders",
  COMPLETED: "Completed",
};

// Tabs shown on the Orders page, in display order.
export const ALL_FOLDER_KEYS: FolderKey[] = ["UNCONFIRMED", "BULK", "SAMPLE", "COMPLETED"];

// Folders actually mirrored to the local computer folder (see folder-sync.ts)
// — Unconfirmed receipts have no invoice number or PDF yet, so there's
// nothing to place on disk until they're confirmed.
export const SYNCABLE_FOLDER_KEYS: FolderKey[] = ["BULK", "SAMPLE", "COMPLETED"];

export function deriveFolder(orderType: string, paymentStatus: string, receiptNumber: number | null): FolderKey {
  if (orderType === "SAMPLE") return "SAMPLE";
  if (receiptNumber == null) return "UNCONFIRMED";
  if (paymentStatus === "PAID") return "COMPLETED";
  return "BULK";
}

export type Category = "MEN" | "WOMEN";

export const CATEGORY_NAMES: Record<Category, string> = {
  MEN: "Men's",
  WOMEN: "Women's",
};

export const ALL_CATEGORIES: Category[] = ["MEN", "WOMEN"];
