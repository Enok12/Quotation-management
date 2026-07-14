// Canonical production-stage order, shared wherever stages need to be
// compared or ranked (not just displayed).
export const ORDER_STAGES = [
  "FABRIC_SELECTION",
  "CUTTING",
  "PRODUCTION",
  "QUALITY_CHECK",
  "IRON_PACKING",
  "DELIVERY",
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

export const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  FABRIC_SELECTION: "Fabric Selection",
  CUTTING: "Cutting",
  PRODUCTION: "Production",
  QUALITY_CHECK: "Quality Check",
  IRON_PACKING: "Iron / Packing",
  DELIVERY: "Delivery",
};

// A receipt's overall status is a cached rollup of its items: whichever
// stage is LEAST advanced among them (the bottleneck) — the order as a whole
// isn't further along than its slowest item.
export function bottleneckStage(statuses: string[]): OrderStage {
  if (statuses.length === 0) return "FABRIC_SELECTION";
  let minIndex = ORDER_STAGES.length - 1;
  for (const s of statuses) {
    const idx = ORDER_STAGES.indexOf(s as OrderStage);
    if (idx >= 0) minIndex = Math.min(minIndex, idx);
  }
  return ORDER_STAGES[minIndex];
}
