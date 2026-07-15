import { cn } from "@/lib/utils/cn";

const RECEIPT_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "badge-draft" },
  FINALIZED: { label: "Finalized", cls: "badge-finalized" },
};

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  FABRIC_SELECTION: { label: "Fabric Selection", cls: "badge-fabric" },
  CUTTING: { label: "Cutting", cls: "badge-cutting" },
  PRODUCTION: { label: "Production", cls: "badge-production" },
  QUALITY_CHECK: { label: "Quality Check", cls: "badge-qc" },
  IRON_PACKING: { label: "Iron / Packing", cls: "badge-packing" },
  DELIVERY: { label: "Delivery", cls: "badge-delivery" },
  COMPLETED: { label: "Completed", cls: "badge-order-completed" },
};

export function ReceiptStatusBadge({ status }: { status: string }) {
  const s = RECEIPT_STATUS[status] ?? { label: status, cls: "badge-draft" };
  return <span className={s.cls}>{s.label}</span>;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, cls: "badge-draft" };
  return <span className={s.cls}>{s.label}</span>;
}

const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  UNPAID: { label: "Unpaid", cls: "badge-unpaid" },
  PARTIALLY_PAID: { label: "Partial Paid", cls: "badge-partial" },
  PAID: { label: "Completed", cls: "badge-paid" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, cls: "badge-draft" };
  return <span className={s.cls}>{s.label}</span>;
}

const ORDER_TYPE: Record<string, { label: string; cls: string }> = {
  BULK: { label: "Bulk", cls: "badge-bulk" },
  SAMPLE: { label: "Sample", cls: "badge-sample" },
};

export function OrderTypeBadge({ type }: { type: string }) {
  const s = ORDER_TYPE[type] ?? { label: type, cls: "badge-draft" };
  return <span className={s.cls}>{s.label}</span>;
}

const CATEGORY: Record<string, { label: string; cls: string }> = {
  MEN: { label: "Men's", cls: "badge-fabric" },
  WOMEN: { label: "Women's", cls: "badge-sample" },
};

export function CategoryBadge({ category }: { category: string }) {
  const s = CATEGORY[category] ?? { label: category, cls: "badge-draft" };
  return <span className={s.cls}>{s.label}</span>;
}
