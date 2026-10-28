"use client";

import { useState, useTransition, useOptimistic, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/skeleton";
import { AlertTriangle, FileText, Loader2, MessageCircle, Search, X } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { arrivingMessage, confirmationMessage, deliveredMessage, dispatchedMessage } from "@/lib/cod-whatsapp";

export interface CodOrderRow {
  saleId: string;
  dispatchRef: string;
  status: "PENDING_CONFIRMATION" | "PENDING_DISPATCH" | "OUT_FOR_DELIVERY" | "DELIVERED" | "REMITTED" | "REFUSED" | "CANCELLED";
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  courierName: string | null;
  waybillNo: string | null;
  codAmount: number;
  deliveryFee: number;
  feePaidBy: "CUSTOMER" | "BUSINESS";
  createdAt: string;
  earlierRefusals: number;
  confirmToken: string | null;
  confirmExpired: boolean;
  items: string;
  closedReason: string | null;
}

const STATUS_LABEL: Record<CodOrderRow["status"], string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  PENDING_DISPATCH: "Ready to dispatch",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered · awaiting payout",
  REMITTED: "Settled",
  REFUSED: "Refused",
  CANCELLED: "Cancelled",
};
const STATUS_CLASS: Record<CodOrderRow["status"], string> = {
  PENDING_CONFIRMATION: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  PENDING_DISPATCH: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  OUT_FOR_DELIVERY: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  DELIVERED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  REMITTED: "bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300",
  REFUSED: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  CANCELLED: "bg-stone-100 text-stone-500 dark:bg-white/10 dark:text-stone-400",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={onClose}>
      <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6 modal-panel-in max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-serif text-xl text-ink">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-ink"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

type Dialog =
  | { kind: "dispatch"; order: CodOrderRow }
  | { kind: "refuse" | "cancel"; order: CodOrderRow }
  | { kind: "settle" };

interface Props {
  orders: CodOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  tabKey: string;
  /** The tab pills, with how many orders each holds. */
  tabs: { key: string; label: string; count: number }[];
  search: string;
  businessName: string;
  isAdmin: boolean;
  refusalThreshold: number;
  /** Selection checkboxes + "Record courier payout" are only offered on the payout tab. */
  canSettle: boolean;
}

export function CodOrdersTable({ orders, total, page, pageSize, tabKey, tabs, search, businessName, isAdmin, refusalThreshold, canSettle }: Props) {
  const router = useRouter();

  // Tabs, search and paging only change the URL's query string, so Next keeps
  // the old table on screen until the new one arrives (a route-level
  // loading.tsx doesn't re-run for a same-page navigation). Doing the
  // navigation in a transition lets us show a skeleton while it's pending and
  // highlight the clicked tab straight away.
  const [navPending, startNav] = useTransition();
  const [shownTab, setShownTab] = useOptimistic(tabKey);
  const [query, setQuery] = useState(search);
  const navigate = (nextTab: string, q: string, p = 1) => {
    const qs = new URLSearchParams({ tab: nextTab });
    if (q.trim()) qs.set("q", q.trim());
    if (p > 1) qs.set("page", String(p));
    setSelected(new Set()); // a payout selection only makes sense for the rows on screen
    startNav(() => {
      setShownTab(nextTab);
      router.push(`/dashboard/retail/cod?${qs.toString()}`);
    });
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const openWhatsApp = (url: string) => window.open(url, "_blank", "noopener");
  const base = (o: CodOrderRow) => ({ businessName, customerName: o.customerName, phone: o.customerPhone, dispatchRef: o.dispatchRef });

  const act = async (saleId: string, body: Record<string, unknown>, then?: () => void) => {
    setBusy(saleId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/inventory/sales/${saleId}/cod`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Something went wrong");
      then?.();
      setDialog(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      // A stale-state conflict is best fixed by reloading what the server now says.
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const selectedOrders = orders.filter((o) => selected.has(o.saleId));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const link = "inline-flex items-center gap-1 text-xs text-stone-500 hover:text-ink transition-colors";

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => {
          const active = t.key === shownTab;
          return (
            <button
              key={t.key} type="button" onClick={() => navigate(t.key, query)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                active
                  ? "bg-ink text-white border-ink dark:bg-stone-100 dark:text-stone-900"
                  : "border-stone-200 dark:border-stone-700 text-stone-500 hover:text-ink"
              }`}
            >
              {t.label} <span className="opacity-60">{t.count}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); navigate(shownTab, query); }} className="flex gap-2 mb-4 max-w-md">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, COD-0001, waybill…" className="field-input pl-9" />
        </div>
        <button className="btn-ghost" disabled={navPending}>Search</button>
      </form>

      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2 mb-4">{error}</p>}

      {canSettle && isAdmin && (
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-stone-500">{selected.size} selected</span>
          <button disabled={selected.size === 0} onClick={() => setDialog({ kind: "settle" })} className="btn-primary disabled:opacity-40">
            Record courier payout
          </button>
        </div>
      )}

      {navPending ? (
        <div aria-busy="true" aria-label="Loading orders">
          <TableSkeleton rows={8} cols={6} />
        </div>
      ) : (
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {canSettle && isAdmin && <th className="th w-8"></th>}
                <th className="th text-left">Order</th>
                <th className="th text-left">Customer</th>
                <th className="th text-left">Courier</th>
                <th className="th text-right">Collect</th>
                <th className="th text-left">Status</th>
                <th className="th text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-stone-400 py-10">No orders here.</td></tr>
              )}
              {orders.map((o) => {
                const rowBusy = busy === o.saleId;
                const refuser = o.earlierRefusals >= refusalThreshold;
                return (
                  <tr key={o.saleId} className="align-top">
                    {canSettle && isAdmin && (
                      <td className="td"><input type="checkbox" checked={selected.has(o.saleId)} onChange={() => toggle(o.saleId)} /></td>
                    )}
                    <td className="td">
                      <div className="font-mono text-sm">{o.dispatchRef}</div>
                      <div className="text-xs text-stone-400">{fmtDate(o.createdAt)}</div>
                      <div className="text-xs text-stone-500 max-w-[14rem] truncate" title={o.items}>{o.items}</div>
                    </td>
                    <td className="td">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-xs text-stone-500">{o.customerPhone}</div>
                      <div className="text-xs text-stone-400 max-w-[14rem] truncate" title={o.deliveryAddress}>{o.deliveryAddress}</div>
                      {refuser && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[11px] rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          <AlertTriangle size={11} /> Frequent refuser ({o.earlierRefusals})
                        </span>
                      )}
                    </td>
                    <td className="td text-sm">
                      {o.courierName ?? <span className="text-stone-300">—</span>}
                      {o.waybillNo && <div className="text-xs text-stone-400 font-mono">{o.waybillNo}</div>}
                    </td>
                    <td className="td text-right font-mono text-sm">
                      {fmtMoney(o.codAmount)}
                      {o.deliveryFee > 0 && (
                        <div className="text-[11px] text-stone-400 font-sans">
                          fee {fmtMoney(o.deliveryFee)} · {o.feePaidBy === "CUSTOMER" ? "customer" : "you"}
                        </div>
                      )}
                    </td>
                    <td className="td">
                      <span className={`inline-block text-xs rounded-full px-2 py-0.5 ${STATUS_CLASS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                      {o.confirmExpired && <div className="text-[11px] text-red-500 mt-1">Link expired</div>}
                      {o.closedReason && <div className="text-[11px] text-stone-400 mt-1 max-w-[10rem]">{o.closedReason}</div>}
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center">
                        {rowBusy && <Loader2 size={14} className="animate-spin text-stone-400" />}

                        {o.status === "PENDING_CONFIRMATION" && (
                          <>
                            {o.confirmToken && (
                              <button className={link} onClick={() => openWhatsApp(confirmationMessage({
                                ...base(o), confirmUrl: `${window.location.origin}/cod-confirm/${o.confirmToken}`, codAmount: o.codAmount,
                              }))}>
                                <MessageCircle size={12} /> Send link
                              </button>
                            )}
                            <button disabled={rowBusy} className={link} onClick={() => act(o.saleId, { action: "confirm" })}>Mark confirmed</button>
                            <button disabled={rowBusy} className={`${link} hover:!text-red-600`} onClick={() => setDialog({ kind: "cancel", order: o })}>Cancel</button>
                          </>
                        )}

                        {o.status === "PENDING_DISPATCH" && (
                          <>
                            <button disabled={rowBusy} className="text-xs font-medium text-ink underline" onClick={() => setDialog({ kind: "dispatch", order: o })}>Dispatch</button>
                            <a className={link} href={`/api/v1/inventory/sales/${o.saleId}/dispatch-sheet`} target="_blank" rel="noopener noreferrer"><FileText size={12} /> Sheet</a>
                            <button disabled={rowBusy} className={`${link} hover:!text-red-600`} onClick={() => setDialog({ kind: "cancel", order: o })}>Cancel</button>
                          </>
                        )}

                        {o.status === "OUT_FOR_DELIVERY" && (
                          <>
                            <button disabled={rowBusy} className="text-xs font-medium text-ink underline" onClick={() => act(o.saleId, { action: "deliver" })}>Delivered</button>
                            <button disabled={rowBusy} className={`${link} hover:!text-red-600`} onClick={() => setDialog({ kind: "refuse", order: o })}>Refused</button>
                            <button className={link} onClick={() => openWhatsApp(dispatchedMessage({ ...base(o), courierName: o.courierName, waybillNo: o.waybillNo, codAmount: o.codAmount }))}><MessageCircle size={12} /> Dispatched</button>
                            <button className={link} onClick={() => openWhatsApp(arrivingMessage({ ...base(o), codAmount: o.codAmount }))}><MessageCircle size={12} /> Arriving</button>
                            <a className={link} href={`/api/v1/inventory/sales/${o.saleId}/dispatch-sheet`} target="_blank" rel="noopener noreferrer"><FileText size={12} /> Sheet</a>
                          </>
                        )}

                        {o.status === "DELIVERED" && (
                          <button className={link} onClick={() => openWhatsApp(deliveredMessage(base(o)))}><MessageCircle size={12} /> Thank customer</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {totalPages > 1 && !navPending && (
        <div className="flex items-center justify-between mt-4 text-sm text-stone-500">
          <span>Page {page} of {totalPages} · {total} orders</span>
          <div className="flex gap-2">
            {page > 1 && <button type="button" className="btn-ghost" onClick={() => navigate(shownTab, query, page - 1)}>Previous</button>}
            {page < totalPages && <button type="button" className="btn-ghost" onClick={() => navigate(shownTab, query, page + 1)}>Next</button>}
          </div>
        </div>
      )}

      {dialog?.kind === "dispatch" && (
        <DispatchDialog order={dialog.order} busy={busy === dialog.order.saleId} onClose={() => setDialog(null)}
          onSubmit={(body) => act(dialog.order.saleId, { action: "dispatch", ...body })} />
      )}
      {(dialog?.kind === "refuse" || dialog?.kind === "cancel") && (
        <ReasonDialog kind={dialog.kind} order={dialog.order} busy={busy === dialog.order.saleId} onClose={() => setDialog(null)}
          onSubmit={(reason) => act(dialog.order.saleId, { action: dialog.kind, reason })} />
      )}
      {dialog?.kind === "settle" && (
        <SettleDialog orders={selectedOrders} onClose={() => setDialog(null)}
          onDone={() => { setSelected(new Set()); setDialog(null); router.refresh(); }} />
      )}
    </div>
  );
}

function DispatchDialog({ order, busy, onClose, onSubmit }: {
  order: CodOrderRow; busy: boolean; onClose: () => void;
  onSubmit: (b: { courierName: string; waybillNo?: string; deliveryFee: number }) => void;
}) {
  const [courier, setCourier] = useState(order.courierName ?? "");
  const [waybill, setWaybill] = useState(order.waybillNo ?? "");
  const [fee, setFee] = useState(String(order.deliveryFee));
  return (
    <Modal title={`Dispatch ${order.dispatchRef}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ courierName: courier.trim(), waybillNo: waybill.trim() || undefined, deliveryFee: Number(fee) || 0 });
      }}>
        <div>
          <label className="field-label">Courier or rider *</label>
          <input required value={courier} onChange={(e) => setCourier(e.target.value)} className="field-input" placeholder="e.g. courier name, or 'Own rider'" autoFocus />
        </div>
        <div>
          <label className="field-label">Waybill / tracking number</label>
          <input value={waybill} onChange={(e) => setWaybill(e.target.value)} className="field-input font-mono" placeholder="issued by the courier — leave blank for an own rider" />
        </div>
        <div>
          <label className="field-label">Delivery fee (Rs.)</label>
          <input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="field-input" />
          <p className="text-xs text-stone-400 mt-1">
            {order.feePaidBy === "CUSTOMER" ? "Paid by the customer — the amount the courier collects changes with the fee." : "Paid by you — comes off your profit."}
          </p>
        </div>
        <button disabled={busy || !courier.trim()} className="btn-primary w-full">
          {busy && <Loader2 size={15} className="animate-spin" />} Mark as out for delivery
        </button>
      </form>
    </Modal>
  );
}

function ReasonDialog({ kind, order, busy, onClose, onSubmit }: {
  kind: "refuse" | "cancel"; order: CodOrderRow; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const refuse = kind === "refuse";
  return (
    <Modal title={refuse ? `Parcel refused — ${order.dispatchRef}` : `Cancel ${order.dispatchRef}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(reason.trim()); }}>
        <p className="text-sm text-stone-500">
          The reserved stock goes back on the shelf.{" "}
          {refuse && "This counts toward this phone number's refusal history."} No refund is created — nothing was collected.
        </p>
        <div>
          <label className="field-label">Reason *</label>
          <input required value={reason} onChange={(e) => setReason(e.target.value)} className="field-input"
            placeholder={refuse ? "e.g. customer not answering, refused to pay" : "e.g. customer changed mind"} autoFocus />
        </div>
        <button disabled={busy || !reason.trim()} className="btn-primary w-full">
          {busy && <Loader2 size={15} className="animate-spin" />} {refuse ? "Mark as refused" : "Cancel order"}
        </button>
      </form>
    </Modal>
  );
}

function SettleDialog({ orders, onClose, onDone }: { orders: CodOrderRow[]; onClose: () => void; onDone: () => void }) {
  const gross = orders.reduce((s, o) => s + o.codAmount, 0);
  const expectedFees = orders.reduce((s, o) => s + o.deliveryFee, 0);
  const couriers = [...new Set(orders.map((o) => (o.courierName ?? "").trim().toLowerCase()))];
  const mixed = couriers.length > 1;

  const [fees, setFees] = useState(String(expectedFees));
  const [net, setNet] = useState(String(gross - expectedFees));
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variance = gross - (Number(fees) || 0) - (Number(net) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/inventory/cod/settlements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleIds: orders.map((o) => o.saleId), courierName: orders[0].courierName ?? "",
          reference: reference.trim() || undefined, receivedAt: date,
          feesDeducted: Number(fees) || 0, netReceived: Number(net) || 0, note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to record payout");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Record courier payout" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm text-stone-500">
          {orders.length} order{orders.length === 1 ? "" : "s"} · {orders[0]?.courierName ?? "unknown courier"} · courier collected{" "}
          <strong className="text-ink">Rs. {fmtMoney(gross)}</strong>
        </p>
        {mixed && <p className="text-sm text-red-500">These orders are from different couriers. Record one courier&apos;s payout at a time.</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Fees deducted</label>
            <input type="number" min="0" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Amount received</label>
            <input type="number" min="0" step="0.01" value={net} onChange={(e) => setNet(e.target.value)} className="field-input" />
          </div>
        </div>
        {Math.abs(variance) >= 0.005 && (
          <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded px-3 py-2">
            Difference of Rs. {fmtMoney(Math.abs(variance))} {variance > 0 ? "short" : "over"} — it will be saved and flagged.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Date received</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Reference</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="field-input" placeholder="statement / bank ref" />
          </div>
        </div>
        <div>
          <label className="field-label">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="field-input" placeholder="optional" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={busy || mixed || orders.length === 0} className="btn-primary w-full">
          {busy && <Loader2 size={15} className="animate-spin" />} Mark {orders.length} order{orders.length === 1 ? "" : "s"} as paid out
        </button>
      </form>
    </Modal>
  );
}
