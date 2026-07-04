import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils/format";

interface Props { searchParams: Promise<{ page?: string }> }
export const metadata = { title: "Audit Log" };

const ACTION_LABELS: Record<string, string> = {
  CUSTOMER_CREATED: "Customer created",
  CUSTOMER_UPDATED: "Customer updated",
  RECEIPT_CREATED: "Receipt created",
  RECEIPT_UPDATED: "Receipt updated",
  RECEIPT_FINALIZED: "Receipt finalized",
  PDF_GENERATED: "PDF generated",
  ORDER_STATUS_CHANGED: "Order status changed",
  VERSION_CREATED: "Version created",
  PAYMENT_RECORDED: "Payment recorded",
  RECEIPT_DELETED: "Receipt deleted",
  CUSTOMER_DELETED: "Customer deleted",
  EXPENSE_RECORDED: "Expense recorded",
  EXPENSE_DELETED: "Expense deleted",
};

export default async function AuditPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 40;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, action: true, entityType: true, entityId: true,
        metadata: true, createdAt: true,
        actor: { select: { email: true, name: true } },
      },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Audit Log</h1>
        <p className="text-stone-500 text-sm mt-1">{total.toLocaleString()} events</p>
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th text-left">When</th>
              <th className="th text-left">Actor</th>
              <th className="th text-left">Action</th>
              <th className="th text-left">Entity</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={4} className="td text-center text-stone-400 py-10">No events yet.</td></tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                <td className="td text-xs text-stone-500 font-mono whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                <td className="td text-xs text-stone-600">{log.actor.name ?? log.actor.email}</td>
                <td className="td">
                  <span className="text-xs font-medium text-ink">{ACTION_LABELS[log.action] ?? log.action}</span>
                </td>
                <td className="td">
                  <span className="text-xs text-stone-500">{log.entityType}</span>
                  <span className="text-xs text-stone-300 font-mono ml-1">·{log.entityId.slice(-6)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <a href={`/dashboard/audit?page=${page - 1}`} className="btn-outline text-xs py-1.5">Previous</a>}
              {page < totalPages && <a href={`/dashboard/audit?page=${page + 1}`} className="btn-outline text-xs py-1.5">Next</a>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
