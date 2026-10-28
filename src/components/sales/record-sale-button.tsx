"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2, Trash2, AlertTriangle, Copy, Check, MessageCircle } from "lucide-react";
import { confirmationMessage } from "@/lib/cod-whatsapp";

const itemSchema = z.object({
  productId: z.string().min(1, "Required"),
  quantity: z.coerce.number().int().positive("Must be > 0"),
  unitPrice: z.coerce.number().nonnegative(),
});
const schema = z
  .object({
    fulfilment: z.enum(["IN_STORE", "COD_DELIVERY"]),
    items: z.array(itemSchema).min(1, "Add at least one product"),
    paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]).optional(),
    note: z.string().optional(),
    // COD-only (validated below when fulfilment is COD_DELIVERY)
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerPhone2: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    deliveryFee: z.coerce.number().nonnegative().optional(),
    feePaidBy: z.enum(["CUSTOMER", "BUSINESS"]).optional(),
    confirmation: z.enum(["LINK", "ALREADY_CONFIRMED"]).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfilment !== "COD_DELIVERY") return;
    if (!v.customerName?.trim()) ctx.addIssue({ code: "custom", path: ["customerName"], message: "Required" });
    if ((v.customerPhone ?? "").replace(/\D/g, "").length < 9) ctx.addIssue({ code: "custom", path: ["customerPhone"], message: "Enter a valid phone number" });
    if (!v.address?.trim()) ctx.addIssue({ code: "custom", path: ["address"], message: "Required" });
  });
type FormValues = z.infer<typeof schema>;

interface Product { id: string; sku: string; name: string; sellingPrice: number; quantityOnHand: number }

interface Refusal { count: number; lastRefusedAt: string | null; flagged: boolean }
interface CodResult {
  dispatchRef: string;
  status: "PENDING_CONFIRMATION" | "PENDING_DISPATCH";
  confirmToken: string | null;
  customerName: string;
  phone: string;
  codAmount: number;
}

const emptyValues: FormValues = {
  fulfilment: "IN_STORE",
  items: [{ productId: "", quantity: 1, unitPrice: 0 }],
  deliveryFee: 0, feePaidBy: "CUSTOMER", confirmation: "LINK",
};

// Sold-so-far quantities of a product ELSEWHERE in this same basket — a
// product line's own max needs to subtract that, not just check against the
// product's total on-hand, so two lines for the same product can't together
// oversell it before the server even sees the request.
function reservedElsewhere(items: FormValues["items"], excludeIndex: number, productId: string): number {
  return items.reduce((sum, it, i) => (i !== excludeIndex && it.productId === productId ? sum + (Number(it.quantity) || 0) : sum), 0);
}

export function RecordSaleButton({
  products, codEnabled = false, businessName = "",
}: { products: Product[]; codEnabled?: boolean; businessName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [codResult, setCodResult] = useState<CodResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const fulfilment = watch("fulfilment");
  const isCod = fulfilment === "COD_DELIVERY";

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const total = watchedItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const fee = Number(watch("deliveryFee")) || 0;
  const feePaidBy = watch("feePaidBy");
  const codAmount = total + (feePaidBy === "CUSTOMER" ? fee : 0);

  const close = () => {
    const created = !!codResult;
    setOpen(false);
    setCodResult(null);
    setRefusal(null);
    setServerError(null);
    setCopied(false);
    reset(emptyValues);
    if (created) router.refresh();
  };

  // Warning only — never blocks the sale. Scoped to this business on the server.
  const checkRefusals = async (phone: string) => {
    if (phone.replace(/\D/g, "").length < 9) { setRefusal(null); return; }
    try {
      const res = await fetch(`/api/v1/inventory/cod/refusal-check?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      setRefusal(json.success ? json.data : null);
    } catch {
      setRefusal(null);
    }
  };

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const body = data.fulfilment === "COD_DELIVERY"
        ? {
            fulfilment: "COD_DELIVERY",
            items: data.items,
            note: data.note || undefined,
            customer: {
              name: data.customerName, phone: data.customerPhone, phone2: data.customerPhone2 || undefined,
              address: data.address, city: data.city || undefined,
            },
            deliveryFee: Number(data.deliveryFee) || 0,
            feePaidBy: data.feePaidBy ?? "CUSTOMER",
            confirmation: data.confirmation ?? "LINK",
          }
        : { items: data.items, paymentMethod: data.paymentMethod, note: data.note };
      const res = await fetch("/api/v1/inventory/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to record sale");

      if (data.fulfilment === "COD_DELIVERY") {
        // Stay open: the seller needs the confirmation link to send on WhatsApp.
        setCodResult({
          dispatchRef: json.data.dispatchRef, status: json.data.status, confirmToken: json.data.confirmToken,
          customerName: data.customerName ?? "", phone: data.customerPhone ?? "", codAmount,
        });
        router.refresh();
        return;
      }
      setOpen(false);
      reset(emptyValues);
      router.refresh();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const confirmUrl = codResult?.confirmToken ? `${window.location.origin}/cod-confirm/${codResult.confirmToken}` : null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} /> Record Sale
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={close}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-2xl p-6 modal-panel-in max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">{codResult ? "COD order created" : isCod ? "New COD Order" : "Record Sale"}</h3>
              <button onClick={close} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            {codResult ? (
              <div className="space-y-4">
                <div className="rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
                  <p className="font-mono text-lg text-ink">{codResult.dispatchRef}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">
                    Stock reserved. Amount to collect on delivery:{" "}
                    <strong>Rs. {codResult.codAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
                  </p>
                </div>

                {confirmUrl ? (
                  <>
                    <p className="text-sm text-stone-500">
                      Send the customer this link so they can check their address and confirm. Their order stays
                      &quot;Pending confirmation&quot; until they do (the link works for 3 days).
                    </p>
                    <div className="flex gap-2">
                      <input readOnly value={confirmUrl} className="field-input text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
                      <button
                        type="button"
                        className="btn-ghost shrink-0"
                        onClick={async () => {
                          try { await navigator.clipboard.writeText(confirmUrl); setCopied(true); } catch { /* clipboard blocked: the field is selectable */ }
                        }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <a
                      href={confirmationMessage({
                        businessName, customerName: codResult.customerName, phone: codResult.phone,
                        dispatchRef: codResult.dispatchRef, confirmUrl, codAmount: codResult.codAmount,
                      })}
                      target="_blank" rel="noopener noreferrer"
                      className="btn-primary w-full justify-center"
                    >
                      <MessageCircle size={15} /> Send confirmation on WhatsApp
                    </a>
                  </>
                ) : (
                  <p className="text-sm text-stone-500">
                    Marked as confirmed — it&apos;s ready to dispatch from the COD Orders page.
                  </p>
                )}
                <button type="button" onClick={close} className="btn-ghost w-full justify-center">Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {codEnabled && (
                  <div className="inline-flex rounded-md border border-stone-200 dark:border-stone-700 p-0.5 text-sm">
                    {([["IN_STORE", "In-store sale"], ["COD_DELIVERY", "Cash on Delivery"]] as const).map(([value, label]) => (
                      <button
                        key={value} type="button"
                        onClick={() => setValue("fulfilment", value, { shouldValidate: false })}
                        className={`px-3 py-1.5 rounded ${fulfilment === value ? "bg-ink text-white dark:bg-stone-100 dark:text-stone-900" : "text-stone-500 hover:text-ink"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="field-label mb-0">Products</label>
                    <button
                      type="button"
                      onClick={() => append({ productId: "", quantity: 1, unitPrice: 0 })}
                      className="btn-ghost text-xs py-1"
                    >
                      <Plus size={12} /> Add product
                    </button>
                  </div>

                  <div className="space-y-2">
                    {fields.map((field, i) => {
                      const selectedId = watchedItems[i]?.productId;
                      const selected = selectedId ? productMap.get(selectedId) : undefined;
                      const maxQty = selected ? selected.quantityOnHand - reservedElsewhere(watchedItems, i, selectedId!) : undefined;
                      return (
                        <div key={field.id} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <select
                                {...register(`items.${i}.productId`)}
                                className="field-input text-xs"
                                onChange={(e) => {
                                  register(`items.${i}.productId`).onChange(e);
                                  const p = productMap.get(e.target.value);
                                  if (p) setValue(`items.${i}.unitPrice`, p.sellingPrice);
                                }}
                              >
                                <option value="">Select a product…</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id} disabled={p.quantityOnHand === 0}>
                                    {p.sku} — {p.name} ({p.quantityOnHand} on hand)
                                  </option>
                                ))}
                              </select>
                              {errors.items?.[i]?.productId && (
                                <p className="field-error">{errors.items[i]?.productId?.message}</p>
                              )}
                            </div>
                            {fields.length > 1 && (
                              <button type="button" onClick={() => remove(i)} className="mt-1 text-stone-300 hover:text-red-400 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <input
                                {...register(`items.${i}.quantity`)}
                                type="number" min="1" step="1" max={maxQty} placeholder="Qty"
                                className="field-input text-xs"
                              />
                              {errors.items?.[i]?.quantity && (
                                <p className="field-error">{errors.items[i]?.quantity?.message}</p>
                              )}
                            </div>
                            <input
                              {...register(`items.${i}.unitPrice`)}
                              type="number" min="0" step="0.01" placeholder="Unit price"
                              className="field-input text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {errors.items && typeof errors.items.message === "string" && (
                    <p className="field-error">{errors.items.message}</p>
                  )}
                </div>

                {isCod && (
                  <div className="space-y-3 rounded-md border border-stone-200 dark:border-stone-700 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Delivery details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Customer name *</label>
                        <input {...register("customerName")} className="field-input" />
                        {errors.customerName && <p className="field-error">{errors.customerName.message}</p>}
                      </div>
                      <div>
                        <label className="field-label">Phone (WhatsApp) *</label>
                        <input
                          {...register("customerPhone", { onBlur: (e) => checkRefusals(e.target.value) })}
                          inputMode="tel" placeholder="07x xxx xxxx" className="field-input"
                        />
                        {errors.customerPhone && <p className="field-error">{errors.customerPhone.message}</p>}
                      </div>
                    </div>

                    {refusal?.flagged && (
                      <div className="flex gap-2 rounded-md border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>
                          This number refused {refusal.count} earlier COD order{refusal.count === 1 ? "" : "s"}
                          {refusal.lastRefusedAt ? `, last on ${new Date(refusal.lastRefusedAt).toLocaleDateString("en-GB")}` : ""}.
                          You can still continue.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Other phone</label>
                        <input {...register("customerPhone2")} inputMode="tel" className="field-input" placeholder="optional" />
                      </div>
                      <div>
                        <label className="field-label">City / town</label>
                        <input {...register("city")} className="field-input" placeholder="optional" />
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Delivery address *</label>
                      <textarea {...register("address")} rows={2} className="field-input resize-none" />
                      {errors.address && <p className="field-error">{errors.address.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Delivery fee (Rs.)</label>
                        <input {...register("deliveryFee")} type="number" min="0" step="0.01" className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">Fee paid by</label>
                        <select {...register("feePaidBy")} className="field-input">
                          <option value="CUSTOMER">Customer (added to COD amount)</option>
                          <option value="BUSINESS">Me (comes off my profit)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="field-label">Customer confirmation</label>
                      <select {...register("confirmation")} className="field-input">
                        <option value="LINK">Send a confirmation link on WhatsApp (recommended)</option>
                        <option value="ALREADY_CONFIRMED">Already confirmed in chat — ready to dispatch</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {!isCod ? (
                    <div>
                      <label className="field-label">Payment Method</label>
                      <select {...register("paymentMethod")} className="field-input">
                        <option value="">Unspecified</option>
                        <option value="CASH">Cash</option>
                        <option value="CARD">Debit/Credit Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 self-end">
                      Items {total.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      {fee > 0 && feePaidBy === "CUSTOMER" ? ` + delivery ${fee.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
                    </div>
                  )}
                  <div className="flex flex-col justify-end items-end">
                    <span className="text-xs text-stone-400 uppercase tracking-wide">{isCod ? "Collect on delivery" : "Total"}</span>
                    <span className="font-serif text-xl text-ink">{(isCod ? codAmount : total).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <label className="field-label">Note</label>
                  <textarea {...register("note")} rows={2} className="field-input resize-none" placeholder="optional" />
                </div>

                {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{serverError}</p>}

                <button type="submit" disabled={isSubmitting || products.length === 0} className="btn-primary w-full">
                  {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                  {isSubmitting ? "Saving…" : isCod ? "Create COD Order" : "Record Sale"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
