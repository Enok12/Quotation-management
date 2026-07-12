"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Download, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fmtMoney } from "@/lib/utils/format";
import { moveInvoiceIfConnected } from "@/lib/folder-sync";
import { deriveFolder } from "@/lib/order-folder";
import { popReceiptDraft } from "@/lib/receipt-draft";

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
  isSample: z.boolean().default(false),
  patternDeductionEnabled: z.boolean().default(false),
  patternDeductionAmount: z.coerce.number().nonnegative().default(2000),
});
type FormValues = z.infer<typeof schema>;

// Pattern Deduction is stored as a normal adjustment row with this exact
// label — no schema change needed. The toggle just adds/removes that row.
const PATTERN_LABEL = "Pattern Deduction";

interface Customer { id: string; name: string; address?: string | null; phone?: string | null; email?: string | null }
interface Props {
  customer: Customer;
  defaultValues?: Partial<FormValues> & { receiptId?: string };
  mode?: "create" | "edit";
  /** Where to navigate after a successful save, instead of the new receipt's
   * detail page — used when opened from the bulk-upload queue, so staff lands
   * back on the queue to review the next item. */
  returnTo?: string;
}

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Debit/Credit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
];

// ---- Totals calculation (mirrors server-side receipt-calc.ts) ----
function calcTotals(items: { quantity: number; unitPrice: number }[], adjs: { amount: number }[], advance: number, paid: number) {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const lineTotals = items.map((i) => r2(i.quantity * i.unitPrice));
  const subtotal = r2(lineTotals.reduce((s, v) => s + v, 0));
  const adjTotal = r2(adjs.reduce((s, a) => s + a.amount, 0));
  const totalDue = r2(subtotal + adjTotal);
  // Balance never shows more owed than totalDue - advance (the advance is
  // reserved from the start); once real payments exceed it, balance tracks them.
  const balance = r2(totalDue - Math.max(advance, paid));
  return { lineTotals, subtotal, adjTotal, totalDue, balance };
}

export function ReceiptBuilder({ customer, defaultValues, mode = "create", returnTo }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mobile (< lg) shows one panel at a time via a tab switcher instead of the
  // desktop side-by-side split. The preview is zoomed to fit whatever width
  // it's given, so the print-accurate 595px page never needs sideways scrolling.
  const [mobileTab, setMobileTab] = useState<"form" | "preview">("form");
  const mobilePreviewWrapRef = useRef<HTMLDivElement>(null);
  const [mobileScale, setMobileScale] = useState(1);
  useEffect(() => {
    const el = mobilePreviewWrapRef.current;
    if (!el) return;
    const PAGE_WIDTH = 595;
    const HORIZONTAL_PADDING = 32; // px-4 on both sides
    const update = () => {
      const available = el.clientWidth - HORIZONTAL_PADDING;
      if (available > 0) setMobileScale(Math.min(1, available / PAGE_WIDTH));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // Pull any existing "Pattern Deduction" row out of the raw adjustments so it
  // renders via the dedicated toggle instead of the generic Adjustments list.
  const rawAdjustments = defaultValues?.adjustments ?? [];
  const existingPattern = rawAdjustments.find((a) => a.label === PATTERN_LABEL);
  const otherAdjustments = rawAdjustments.filter((a) => a.label !== PATTERN_LABEL);

  const {
    register, control, watch, setValue, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today,
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
      paymentMethods: [],
      advanceAmount: 0,
      amountPaid: 0,
      isSample: false,
      ...defaultValues,
      adjustments: otherAdjustments,
      patternDeductionEnabled: !!existingPattern,
      patternDeductionAmount: existingPattern ? Math.abs(Number(existingPattern.amount)) : 2000,
    },
  });

  // Advance auto-fills to 60% of the total until the user overrides it.
  const [advanceTouched, setAdvanceTouched] = useState(mode === "edit" || (defaultValues?.advanceAmount ?? 0) > 0);

  // If a receipt was just uploaded-and-extracted, apply the stashed draft on
  // first mount (create mode only) — replaces the blank defaults with the
  // parsed fields so staff lands on a pre-filled, still-editable form.
  const [draftApplied, setDraftApplied] = useState(false);
  useEffect(() => {
    if (mode !== "create" || defaultValues?.receiptId) return;
    const draft = popReceiptDraft();
    if (!draft) return;

    const patternRow = draft.adjustments.find((a) => a.label === PATTERN_LABEL);
    reset({
      date: draft.date ?? today,
      items: draft.items.length > 0 ? draft.items : [{ description: "", quantity: 1, unitPrice: 0 }],
      paymentMethods: draft.paymentMethods,
      adjustments: draft.adjustments.filter((a) => a.label !== PATTERN_LABEL),
      advanceAmount: draft.advanceAmount ?? 0,
      amountPaid: draft.amountPaid ?? 0,
      isSample: false,
      patternDeductionEnabled: !!patternRow,
      patternDeductionAmount: patternRow ? Math.abs(Number(patternRow.amount)) : 2000,
    });
    if (draft.advanceAmount != null) setAdvanceTouched(true);
    setDraftApplied(true);
    // Runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fields: itemFields, append: addItem, remove: removeItem } = useFieldArray({ control, name: "items" });
  const { fields: adjFields, append: addAdj, remove: removeAdj } = useFieldArray({ control, name: "adjustments" });

  const watchedValues = watch();
  const items = watchedValues.items ?? [];
  const adjs = watchedValues.adjustments ?? [];
  const isSample = watchedValues.isSample ?? false;
  const patternDeductionEnabled = watchedValues.patternDeductionEnabled ?? false;
  const patternDeductionAmount = Number(watchedValues.patternDeductionAmount) || 0;

  // Combine manual adjustments with the Pattern Deduction toggle for totals/preview.
  const allAdjustments = patternDeductionEnabled
    ? [...adjs, { label: PATTERN_LABEL, amount: -patternDeductionAmount }]
    : adjs;

  // Sample orders are single-unit — force every item quantity to 1.
  useEffect(() => {
    if (!isSample) return;
    items.forEach((_, i) => setValue(`items.${i}.quantity`, 1, { shouldDirty: false }));
  }, [isSample, items.length, setValue]);
  const totals = calcTotals(
    items.map((i) => ({ quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0 })),
    allAdjustments.map((a) => ({ amount: Number(a.amount) || 0 })),
    Number(watchedValues.advanceAmount) || 0,
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
        orderType: data.isSample ? "SAMPLE" : "BULK",
        items: data.items.map((i) => ({
          description: i.description,
          quantity: data.isSample ? 1 : Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
        adjustments: [
          ...data.adjustments.map((a) => ({ label: a.label, amount: Number(a.amount) })),
          ...(data.patternDeductionEnabled
            ? [{ label: PATTERN_LABEL, amount: -Number(data.patternDeductionAmount) }]
            : []),
        ],
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

      // Keep the computer folder mirror in sync with whatever was just saved
      // (e.g. quantities set after converting a sample to bulk).
      const saved = json.data;
      await moveInvoiceIfConnected(
        saved.id, saved.receiptNumber, saved.custName,
        deriveFolder(saved.orderType, saved.paymentStatus),
      );

      router.push(returnTo ?? `/dashboard/receipts/${json.data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSaving(false);
    }
  }, [customer.id, mode, defaultValues?.receiptId, returnTo, router]);

  const date = watchedValues.date ?? today;
  const paymentMethods = watchedValues.paymentMethods ?? [];

  return (
    <div className="flex flex-col lg:flex-row h-full lg:overflow-hidden overflow-y-auto">
      {/* Mobile tab switcher: one panel at a time below lg, both side-by-side at lg+ */}
      <div className="lg:hidden flex items-center gap-1 p-2 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex-none">
        <button
          type="button"
          onClick={() => setMobileTab("form")}
          className={cn(
            "flex-1 py-2 text-sm font-medium rounded transition-colors",
            mobileTab === "form" ? "bg-ink text-white dark:bg-white dark:text-stone-900" : "text-stone-500 hover:bg-stone-100 dark:hover:bg-white/10",
          )}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={cn(
            "flex-1 py-2 text-sm font-medium rounded transition-colors",
            mobileTab === "preview" ? "bg-ink text-white dark:bg-white dark:text-stone-900" : "text-stone-500 hover:bg-stone-100 dark:hover:bg-white/10",
          )}
        >
          Preview
        </button>
      </div>

      {/* ---- LEFT: Form ---- */}
      <div className={cn(mobileTab === "form" ? "flex" : "hidden", "lg:flex w-full lg:w-[420px] flex-none border-b lg:border-b-0 lg:border-r border-stone-200 dark:border-stone-700 lg:overflow-y-auto bg-stone-25 dark:bg-stone-900 flex-col")}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
          <div className="px-6 pt-6 pb-4 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800">
            <h2 className="font-serif text-xl text-ink">
              {mode === "edit" ? "Edit Receipt" : "New Receipt"}
            </h2>
            <p className="text-sm text-stone-500 mt-0.5">For {customer.name}</p>
          </div>

          {draftApplied && (
            <div className="mx-6 mt-4 flex items-start justify-between gap-2 rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <span>Auto-filled from an uploaded receipt — please review before saving.</span>
              <button type="button" onClick={() => setDraftApplied(false)} className="text-amber-500 hover:text-amber-700 flex-none">
                <X size={13} />
              </button>
            </div>
          )}

          <div className="flex-1 px-6 py-5 space-y-6 lg:overflow-y-auto">
            {/* Date */}
            <div>
              <label className="field-label">Date</label>
              <input type="date" {...register("date")} className="field-input" />
              {errors.date && <p className="field-error">{errors.date.message}</p>}
            </div>

            {/* Sample order toggle */}
            <label className="flex items-start gap-3 cursor-pointer bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md p-3 hover:border-purple-300 transition-colors">
              <input type="checkbox" {...register("isSample")} className="mt-0.5 accent-purple-500" />
              <span>
                <span className="text-sm font-medium text-ink">Sample order</span>
                <span className="block text-xs text-stone-500 mt-0.5">
                  Single-unit development for quality check. Quantity is locked to 1; convert to a bulk order later if the customer approves.
                </span>
              </span>
            </label>

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
                  <div key={field.id} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md p-3 space-y-2">
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
                          disabled={isSample}
                          title={isSample ? "Sample orders are single-unit" : undefined}
                          className="field-input text-xs disabled:bg-stone-100 disabled:text-stone-400 dark:disabled:bg-stone-700 dark:disabled:text-stone-500"
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
                  <div key={field.id} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md p-3">
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

            {/* Pattern Deduction */}
            <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" {...register("patternDeductionEnabled")} className="mt-0.5 accent-amber-400" />
                <span className="flex-1">
                  <span className="text-sm font-medium text-ink">Pattern Deduction</span>
                  <span className="block text-xs text-stone-500 mt-0.5">
                    Deducts the pattern making cost already paid (e.g. during the sample stage).
                  </span>
                </span>
              </label>
              {patternDeductionEnabled && (
                <div className="mt-3 pl-7">
                  <label className="field-label">Amount</label>
                  <input
                    {...register("patternDeductionAmount")}
                    type="number" min="0" step="0.01"
                    className="field-input text-xs"
                  />
                </div>
              )}
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
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-3 py-2 text-sm hover:border-amber-400 transition-colors">
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
          <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 space-y-3">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? "Saving…" : mode === "edit" ? "Save Changes" : "Create Receipt"}
            </button>
          </div>
        </form>
      </div>

      {/* ---- RIGHT: Live preview (desktop, true size, side-by-side) ---- */}
      <div className="hidden lg:flex flex-1 overflow-auto bg-stone-100 dark:bg-stone-950 items-start justify-center py-8 px-8">
        <div
          // Always mimics printed paper (white page, black ink) — intentionally
          // NOT theme-aware, regardless of site dark mode.
          className="bg-white text-black shadow-lg flex-none"
          style={{ width: 595, minHeight: 841, fontFamily: "Times New Roman, serif", fontSize: 10 }}
        >
          <ReceiptPreview
            customer={customer}
            date={date}
            items={items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))}
            adjustments={allAdjustments.map((a) => ({ ...a, amount: Number(a.amount) }))}
            paymentMethods={paymentMethods}
            totals={totals}
            advanceAmount={Number(watchedValues.advanceAmount) || 0}
            amountPaid={Number(watchedValues.amountPaid) || 0}
          />
        </div>
      </div>

      {/* ---- RIGHT: Live preview (mobile, zoomed to fit width, tab-controlled) ---- */}
      <div
        ref={mobilePreviewWrapRef}
        className={cn(mobileTab === "preview" ? "flex" : "hidden", "lg:hidden flex-1 overflow-y-auto bg-stone-100 dark:bg-stone-950 justify-center py-6 px-4")}
      >
        <div
          className="bg-white text-black shadow-lg flex-none"
          style={{ width: 595, minHeight: 841, fontFamily: "Times New Roman, serif", fontSize: 10, zoom: mobileScale }}
        >
          <ReceiptPreview
            customer={customer}
            date={date}
            items={items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))}
            adjustments={allAdjustments.map((a) => ({ ...a, amount: Number(a.amount) }))}
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
