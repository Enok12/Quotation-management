"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2, Trash2 } from "lucide-react";

const itemSchema = z.object({
  productId: z.string().min(1, "Required"),
  quantity: z.coerce.number().int().positive("Must be > 0"),
  unitPrice: z.coerce.number().nonnegative(),
});
const schema = z.object({
  items: z.array(itemSchema).min(1, "Add at least one product"),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]).optional(),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Product { id: string; sku: string; name: string; sellingPrice: number; quantityOnHand: number }

// Sold-so-far quantities of a product ELSEWHERE in this same basket — a
// product line's own max needs to subtract that, not just check against the
// product's total on-hand, so two lines for the same product can't together
// oversell it before the server even sees the request.
function reservedElsewhere(items: FormValues["items"], excludeIndex: number, productId: string): number {
  return items.reduce((sum, it, i) => (i !== excludeIndex && it.productId === productId ? sum + (Number(it.quantity) || 0) : sum), 0);
}

export function RecordSaleButton({ products }: { products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ productId: "", quantity: 1, unitPrice: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const total = watchedItems.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/v1/inventory/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to record sale");
      setOpen(false);
      reset({ items: [{ productId: "", quantity: 1, unitPrice: 0 }] });
      router.refresh();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} /> Record Sale
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-2xl p-6 modal-panel-in max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Record Sale</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
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
                <div className="flex flex-col justify-end items-end">
                  <span className="text-xs text-stone-400 uppercase tracking-wide">Total</span>
                  <span className="font-serif text-xl text-ink">{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="field-label">Note</label>
                <textarea {...register("note")} rows={2} className="field-input resize-none" placeholder="optional" />
              </div>

              {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{serverError}</p>}

              <button type="submit" disabled={isSubmitting || products.length === 0} className="btn-primary w-full">
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                {isSubmitting ? "Saving…" : "Record Sale"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
