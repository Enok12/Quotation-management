"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fmtMoney } from "@/lib/utils/format";

// ---- Types ----
const itemSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z.coerce.number().int().positive("Must be > 0"),
  unitPrice: z.coerce.number().nonnegative("Must be ≥ 0"),
});
const adjSchema = z.object({
  label: z.string().min(1, "Required"),
  amount: z.coerce.number(),
});
const schema = z.object({
  date: z.string().min(1, "Required"),
  notes: z.string().optional(),
  paymentMethods: z.array(z.string()).default([]),
  items: z.array(itemSchema).min(1, "Add at least one item"),
  adjustments: z.array(adjSchema).default([]),
  advanceAmount: z.coerce.number().nonnegative().default(0),
  amountPaid: z.coerce.number().nonnegative().default(0),
});
type FormValues = z.infer<typeof schema>;

interface Customer { id: string; name: string; address?: string | null; phone?: string | null; email?: string | null }
interface Props {
  customer: Customer;
  defaultValues?: Partial<FormValues> & { receiptId?: string };
  mode?: "create" | "edit";
}

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Debit/Credit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
];

// ---- Totals calculation (mirrors server-side receipt-calc.ts) ----
function calcTotals(items: { quantity: number; unitPrice: number }[], adjs: { amount: number }[], paid: number) {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const lineTotals = items.map((i) => r2(i.quantity * i.unitPrice));
  const subtotal = r2(lineTotals.reduce((s, v) => s + v, 0));
  const adjTotal = r2(adjs.reduce((s, a) => s + a.amount, 0));
  const totalDue = r2(subtotal + adjTotal);
  // Only money actually paid reduces the balance; advance is just a quote.
  const balance = r2(totalDue - paid);
  return { lineTotals, subtotal, adjTotal, totalDue, balance };
}

export function ReceiptBuilder({ customer, defaultValues, mode = "create" }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const {
    register, control, watch, setValue, handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today,
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
      adjustments: [],
      paymentMethods: [],
      advanceAmount: 0,
      amountPaid: 0,
      ...defaultValues,
    },
  });

  // Advance auto-fills to 60% of the total until the user overrides it.
  const [advanceTouched, setAdvanceTouched] = useState(mode === "edit" || (defaultValues?.advanceAmount ?? 0) > 0);

  const { fields: itemFields, append: addItem, remove: removeItem } = useFieldArray({ control, name: "items" });
  const { fields: adjFields, append: addAdj, remove: removeAdj } = useFieldArray({ control, name: "adjustments" });

  const watchedValues = watch();
  const items = watchedValues.items ?? [];
  const adjs = watchedValues.adjustments ?? [];
  const totals = calcTotals(
    items.map((i) => ({ quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0 })),
    adjs.map((a) => ({ amount: Number(a.amount) || 0 })),
    Number(watchedValues.amountPaid) || 0,
  );

  // Keep the advance at 60% of the total until staff edit it manually.
  useEffect(() => {
    if (advanceTouched) return;
    const sixty = Math.round(totals.totalDue * 0.6 * 100) / 100;
    setValue("advanceAmount", sixty, { shouldDirty: false });
  }, [totals.totalDue, advanceTouched, setValue]);

  const onSubmit = useCallback(async (data: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        customerId: customer.id,
        date: new Date(data.date).toISOString(),
        notes: data.notes,
        paymentMethods: data.paymentMethods,
        items: data.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
        adjustments: data.adjustments.map((a) => ({
          label: a.label, amount: Number(a.amount),
        })),
        advanceAmount: Number(data.advanceAmount),
        amountPaid: Number(data.amountPaid),
      };

      const url = mode === "edit" && defaultValues?.receiptId
        ? `/api/v1/receipts/${defaultValues.receiptId}`
        : "/api/v1/receipts";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save");
      router.push(`/dashboard/receipts/${json.data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }, [customer.id, mode, defaultValues?.receiptId, router]);

  const date = watchedValues.date ?? today;
  const paymentMethods = watchedValues.paymentMethods ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ---- LEFT: Form ---- */}
      <div className="w-[420px] flex-none border-r border-stone-200 overflow-y-auto bg-stone-25 flex flex-col">
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
          <div className="px-6 pt-6 pb-4 border-b border-stone-200 bg-white">
            <h2 className="font-serif text-xl text-ink">
              {mode === "edit" ? "Edit Receipt" : "New Receipt"}
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">For {customer.name}</p>
          </div>

          <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">
            {/* Date */}
            <div>
              <label className="field-label">Date</label>
              <input type="date" {...register("date")} className="field-input" />
              {errors.date && <p className="field-error">{errors.date.message}</p>}
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="field-label mb-0">Items</label>
                <button
                  type="button"
                  onClick={() => addItem({ description: "", quantity: 1, unitPrice: 0 })}
                  className="btn-ghost text-xs py-1"
                >
                  <Plus size={12} /> Add item
                </button>
              </div>
              <div className="space-y-2">
                {itemFields.map((field, i) => (
                  <div key={field.id} className="bg-white border border-stone-200 rounded-md p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <input
                          {...register(`items.${i}.description`)}
                          placeholder="Description"
                          className="field-input text-xs"
                        />
                        {errors.items?.[i]?.description && (
                          <p className="field-error">{errors.items[i]?.description?.message}</p>
                        )}
                      </div>
                      {itemFields.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="mt-1 text-stone-300 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          {...register(`items.${i}.quantity`)}
                          type="number" min="1" placeholder="Qty"
                          className="field-input text-xs"
                        />
                        {errors.items?.[i]?.quantity && (
                          <p className="field-error">{errors.items[i]?.quantity?.message}</p>
                        )}
                      </div>
                      <div>
                        <input
                          {...register(`items.${i}.unitPrice`)}
                          type="number" min="0" step="0.01" placeholder="Unit price"
                          className="field-input text-xs"
                        />
                      </div>
                    </div>
                    {(Number(items[i]?.quantity) > 0 && Number(items[i]?.unitPrice) > 0) && (
                      <p className="text-xs text-stone-400 text-right">
                        = {fmtMoney(Number(items[i]?.quantity) * Number(items[i]?.unitPrice))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Adjustments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="field-label mb-0">Adjustments</label>
                <button
                  type="button"
                  onClick={() => addAdj({ label: "", amount: 0 })}
                  className="btn-ghost text-xs py-1"
                >
                  <Plus size={12} /> Add line
                </button>
              </div>
              <div className="space-y-2">
                {adjFields.map((field, i) => (
                  <div key={field.id} className="bg-white border border-stone-200 rounded-md p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        {...register(`adjustments.${i}.label`)}
                        placeholder="Label (e.g. Pattern)"
                        className="field-input text-xs"
                      />
                      <div className="flex gap-2">
                        <input
                          {...register(`adjustments.${i}.amount`)}
                          type="number" step="0.01" placeholder="Amount (negative = discount)"
                          className="field-input text-xs flex-1"
                        />
                        <button type="button" onClick={() => removeAdj(i)} className="text-stone-300 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Advance / Paid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Advance Payment</label>
                <input
                  {...register("advanceAmount")}
                  onInput={() => setAdvanceTouched(true)}
                  type="number" min="0" step="0.01" className="field-input"
                />
                <p className="text-xs text-stone-400 mt-1">60% of total by default — expected, not yet paid.</p>
              </div>
              <div>
                <label className="field-label">Amount Paid</label>
                <input {...register("amountPaid")} type="number" min="0" step="0.01" className="field-input" />
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="field-label">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer bg-white border border-stone-200 rounded px-3 py-2 text-sm hover:border-amber-400 transition-colors">
                    <input
                      type="checkbox"
                      value={opt.value}
                      {...register("paymentMethods")}
                      className="accent-amber-400"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="field-label">Notes (optional)</label>
              <textarea {...register("notes")} rows={2} placeholder="Internal notes…" className="field-input resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-stone-200 bg-white space-y-3">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Receipt"}
            </button>
          </div>
        </form>
      </div>

      {/* ---- RIGHT: Live preview ---- */}
      <div className="flex-1 overflow-auto bg-stone-100 flex items-start justify-center py-8 px-8">
        <div
          className="bg-white shadow-lg"
          style={{ width: 595, minHeight: 841, fontFamily: "Times New Roman, serif", fontSize: 10 }}
        >
          <ReceiptPreview
            customer={customer}
            date={date}
            items={items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))}
            adjustments={adjs.map((a) => ({ ...a, amount: Number(a.amount) }))}
            paymentMethods={paymentMethods}
            totals={totals}
            advanceAmount={Number(watchedValues.advanceAmount) || 0}
            amountPaid={Number(watchedValues.amountPaid) || 0}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Live preview component (mirrors the PDF layout as faithfully as possible in HTML) ----
function ReceiptPreview({
  customer, date, items, adjustments, paymentMethods, totals, advanceAmount, amountPaid,
}: {
  customer: Customer;
  date: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  adjustments: { label: string; amount: number }[];
  paymentMethods: string[];
  totals: ReturnType<typeof calcTotals>;
  advanceAmount: number;
  amountPaid: number;
}) {
  const has = (v: string) => paymentMethods.includes(v);

  const custRows: [string, string][] = [
    ["Name", customer.name],
    ["Address", customer.address ?? ""],
    ["Phone", customer.phone ?? ""],
    ["Email", customer.email ?? ""],
  ];
  const payRows: [string, boolean][] = [
    ["Cash", has("CASH")],
    ["Debit/Credit Card", has("CARD")],
    ["Bank Transfer", has("BANK_TRANSFER")],
    ["Other", has("OTHER")],
  ];
  const totalRows = [
    ...adjustments.filter((a) => a.label).map((a) => [a.label, fmtMoney(a.amount)] as [string, string]),
    ["Total Due", fmtMoney(totals.totalDue)],
    ["Advance Payment", fmtMoney(advanceAmount)],
    ["Amount Paid", fmtMoney(amountPaid)],
    ["Balance", fmtMoney(totals.balance)],
  ];

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return d; }
  };

  return (
    <div style={{ padding: "26px", border: "1px solid #9e9e9e", margin: 14, minHeight: 793, position: "relative" }}>
      {/* Watermark */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        opacity: 0.04, fontSize: 180, fontWeight: 700, color: "#000", pointerEvents: "none",
        whiteSpace: "nowrap", letterSpacing: -4,
      }}>M</div>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/montra-wordmark.png" alt="MONTRA" style={{ height: 40, display: "inline-block" }} />
      </div>

      {/* Heading */}
      <div style={{ fontSize: 22, fontFamily: "Times New Roman, serif", marginBottom: 10 }}>BUSINESS RECEIPT</div>
      <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Date: {fmtDate(date)}</div>

      {/* Customer / Payment table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, marginBottom: 14 }}>
        <thead>
          <tr>
            <th colSpan={2} style={thStyle}>CUSTOMER DETAILS</th>
            <th colSpan={2} style={thStyle}>PAYMENT INFORMATION</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((i) => (
            <tr key={i}>
              <td style={{ ...tdStyle, fontWeight: 700, width: "13%" }}>{custRows[i][0]}</td>
              <td style={{ ...tdStyle, width: "37%" }}>{custRows[i][1]}</td>
              <td style={{ ...tdStyle, fontWeight: 700, width: "18%" }}>{payRows[i][0]}</td>
              <td style={{ ...tdStyle, width: "32%" }}>{payRows[i][1] ? "✓" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...tdStyle, ...hdrStyle, width: "8%", textAlign: "center" }}>Qty</th>
            <th style={{ ...tdStyle, ...hdrStyle }}>Description</th>
            <th style={{ ...tdStyle, ...hdrStyle, width: "22%", textAlign: "left" }}>Unit Price</th>
            <th style={{ ...tdStyle, ...hdrStyle, width: "16%", textAlign: "left" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.filter((i) => i.description || i.quantity || i.unitPrice).map((item, i) => (
            <tr key={i}>
              <td style={{ ...tdStyle, textAlign: "center" }}>{item.quantity || ""}</td>
              <td style={tdStyle}>{item.description}</td>
              <td style={tdStyle}>
                {item.unitPrice && item.quantity ? `${fmtMoney(item.unitPrice)} x ${item.quantity}` : ""}
              </td>
              <td style={tdStyle}>{totals.lineTotals[i] ? fmtMoney(totals.lineTotals[i]) : ""}</td>
            </tr>
          ))}
          {/* Totals rows */}
          {totalRows.map(([label, val]) => (
            <tr key={label}>
              <td colSpan={2} style={tdStyle} />
              <td style={{ ...tdStyle, ...hdrStyle }}>{label}</td>
              <td style={tdStyle}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  border: "1px solid #c8c8c8", padding: "5px 8px", fontSize: 9.5,
};
const thStyle: React.CSSProperties = {
  ...tdStyle, fontWeight: 700, textAlign: "center", fontSize: 9.5,
};
const hdrStyle: React.CSSProperties = {
  backgroundColor: "#f5d9a8", fontWeight: 700,
};
