// Curated apparel search terms whose Google-Trends time-series drive the
// Recommendations section. Deliberately fixed (not discovered from Google's
// related-queries, which are noisy — "dress up game", "dress removal ai" — and
// would waste SerpApi calls). Each carries a category hint so the eventual
// recommendation cards can keep the Men's / Women's split.
//
// SerpApi time-series compares up to 5 terms per call, so keep each list a
// small multiple of 5 to stay cheap (≈3 calls per region per month).

export type TrendCategory = "MEN" | "WOMEN" | "BOTH";

export interface TrendTerm {
  term: string;
  category: TrendCategory;
}

// Sri Lanka — universal staples plus locally significant garments.
export const LOCAL_TERMS: TrendTerm[] = [
  { term: "frock", category: "WOMEN" },
  { term: "saree", category: "WOMEN" },
  { term: "blouse", category: "WOMEN" },
  { term: "kurti", category: "WOMEN" },
  { term: "party dress", category: "WOMEN" },
  { term: "office wear", category: "BOTH" },
  { term: "men's shirt", category: "MEN" },
  { term: "trouser", category: "MEN" },
  { term: "t-shirt", category: "BOTH" },
  { term: "denim", category: "BOTH" },
  { term: "sarong", category: "MEN" },
  { term: "batik", category: "BOTH" },
  { term: "linen shirt", category: "BOTH" },
  { term: "cargo pants", category: "BOTH" },
  { term: "wedding dress", category: "WOMEN" },
];

// Global fashion — terms that reflect worldwide apparel movement.
export const GLOBAL_TERMS: TrendTerm[] = [
  { term: "cargo pants", category: "BOTH" },
  { term: "linen shirt", category: "BOTH" },
  { term: "oversized t-shirt", category: "BOTH" },
  { term: "wide leg trousers", category: "BOTH" },
  { term: "co-ord set", category: "WOMEN" },
  { term: "maxi dress", category: "WOMEN" },
  { term: "corset top", category: "WOMEN" },
  { term: "pleated skirt", category: "WOMEN" },
  { term: "knit sweater", category: "BOTH" },
  { term: "denim jacket", category: "BOTH" },
  { term: "polo shirt", category: "MEN" },
  { term: "chino pants", category: "MEN" },
  { term: "hoodie", category: "BOTH" },
  { term: "slip dress", category: "WOMEN" },
  { term: "puffer jacket", category: "BOTH" },
];

export function termsFor(region: "LOCAL" | "GLOBAL"): TrendTerm[] {
  return region === "LOCAL" ? LOCAL_TERMS : GLOBAL_TERMS;
}

// SerpApi geo code — empty string means worldwide.
export function geoFor(region: "LOCAL" | "GLOBAL"): string {
  return region === "LOCAL" ? "LK" : "";
}
