"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpDown, X, Loader2 } from "lucide-react";

const schema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().positive("Must be > 0"),
  reason: z.string().min(1, "Required"),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const REASONS: Record<FormValues["type"], string[]> = {
  IN: ["Received from supplier", "Returned by customer", "Other"],
  OUT: ["Sold", "Damaged / Lost", "Other"],
  ADJUSTMENT: ["Stock count correction", "Other"],
};

export function AdjustStockButton({ productId, sku, quantityOnHand }: { productId: string; sku: string; quantityOnHand: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "IN", quantity: 1, reason: "" },
  });
  const type = watch("type");

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch(`/api/v1/inventory/products/${productId}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to adjust stock");
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Adjust Stock"
        aria-label="Adjust Stock"
        className="text-stone-400 hover:text-amber-600 dark:text-stone-500 dark:hover:text-amber-400 transition-colors p-1"
      >
        <ArrowUpDown size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-serif text-xl text-ink">Adjust Stock</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <p className="text-sm text-stone-500 mb-4">
              <code className="font-mono">{sku}</code> · {quantityOnHand} on hand
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="field-label">Type</label>
                <select {...register("type")} className="field-input">
                  <option value="IN">Stock In</option>
                  <option value="OUT">Stock Out</option>
                  <option value="ADJUSTMENT">Adjustment (correction)</option>
                </select>
              </div>

              <div>
                <label className="field-label">Quantity *</label>
                <input {...register("quantity")} type="number" min="1" step="1" className="field-input" autoFocus />
                {errors.quantity && <p className="field-error">{errors.quantity.message}</p>}
              </div>

              <div>
                <label className="field-label">Reason *</label>
                <select {...register("reason")} className="field-input">
                  <option value="">Select a reason…</option>
                  {REASONS[type].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.reason && <p className="field-error">{errors.reason.message}</p>}
              </div>

              <div>
                <label className="field-label">Note</label>
                <textarea {...register("note")} rows={2} className="field-input resize-none" placeholder="optional" />
              </div>

              {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{serverError}</p>}

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                {isSubmitting ? "Saving…" : "Save Adjustment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
