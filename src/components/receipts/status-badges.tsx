import { cn } from "@/lib/utils/cn";

const RECEIPT_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "badge-draft" },
  FINALIZED: { label: "Finalized", cls: "badge-finalized" },
};

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "badge-pending" },
  IN_PROGRESS: { label: "In Progress", cls: "badge-in-progress" },
  COMPLETED: { label: "Completed", cls: "badge-completed" },
  CANCELLED: { label: "Cancelled", cls: "badge-cancelled" },
};

export function ReceiptStatusBadge({ status }: { status: string }) {
  const s = RECEIPT_STATUS[status] ?? { label: status, cls: "badge-draft" };
  return <span className={s.cls}>{s.label}</span>;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, cls: "badge-draft" };
  return <span className={s.cls}>{s.label}</span>;
}
