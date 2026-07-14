// Single source of truth for which folder a receipt belongs in.
// Used by the in-app Orders section and the computer folder sync.
//
//   SAMPLE order            → Sample Orders   (stays here until converted/deleted)
//   BULK order, fully paid  → Completed
//   BULK order, otherwise   → BULK ORDERS     (unpaid / advance)
//
// Each receipt also belongs to a top-level category (Men's / Women's), so
// the full on-disk path is <category>/<folder>, e.g. "Men's/BULK ORDERS".

export type FolderKey = "BULK" | "SAMPLE" | "COMPLETED";

// On-disk folder names (also the tab labels).
export const FOLDER_NAMES: Record<FolderKey, string> = {
  BULK: "BULK ORDERS",
  SAMPLE: "Sample Orders",
  COMPLETED: "Completed",
};

export const ALL_FOLDER_KEYS: FolderKey[] = ["BULK", "SAMPLE", "COMPLETED"];

export function deriveFolder(orderType: string, paymentStatus: string): FolderKey {
  if (orderType === "SAMPLE") return "SAMPLE";
  if (paymentStatus === "PAID") return "COMPLETED";
  return "BULK";
}

export type Category = "MEN" | "WOMEN";

export const CATEGORY_NAMES: Record<Category, string> = {
  MEN: "Men's",
  WOMEN: "Women's",
};

export const ALL_CATEGORIES: Category[] = ["MEN", "WOMEN"];
