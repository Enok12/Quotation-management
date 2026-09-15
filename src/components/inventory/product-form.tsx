"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

const productFormSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  costPrice: z.coerce.number().nonnegative().default(0),
  sellingPrice: z.coerce.number().nonnegative().default(0),
  openingQuantity: z.coerce.number().int().nonnegative().default(0),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

interface SavedProduct { id: string; sku: string }

// Shared create/edit form — mirrors AddCustomerForm's shape. openingQuantity
// only applies at creation (quantityOnHand is never edited directly after
// that — see inventory.service.ts), so it's hidden in edit mode.
export function ProductForm({
  productId,
  defaultValues,
  onSaved,
  submitLabel = "Add Product",
}: {
  productId?: string;
  defaultValues?: Partial<ProductFormValues>;
  onSaved: (product: SavedProduct) => void;
  submitLabel?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { costPrice: 0, sellingPrice: 0, openingQuantity: 0, ...defaultValues },
  });

  const onSubmit = async (data: ProductFormValues) => {
    setServerError(null);
    try {
      const payload = productId
        ? { sku: data.sku, name: data.name, category: data.category, costPrice: data.costPrice, sellingPrice: data.sellingPrice }
        : data;
      const res = await fetch(productId ? `/api/v1/inventory/products/${productId}` : "/api/v1/inventory/products", {
        method: productId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? `Failed to ${productId ? "save" : "add"} product`);
      onSaved(json.data);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="field-label">SKU *</label>
        <input {...register("sku")} className="field-input font-mono" placeholder="e.g. SKU-001" autoFocus />
        {errors.sku && <p className="field-error">{errors.sku.message}</p>}
      </div>

      <div>
        <label className="field-label">Name *</label>
        <input {...register("name")} className="field-input" placeholder="Product name" />
        {errors.name && <p className="field-error">{errors.name.message}</p>}
      </div>

      <div>
        <label className="field-label">Category</label>
        <input {...register("category")} className="field-input" placeholder="optional" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Cost Price</label>
          <input {...register("costPrice")} type="number" step="0.01" min="0" className="field-input" />
        </div>
        <div>
          <label className="field-label">Selling Price</label>
          <input {...register("sellingPrice")} type="number" step="0.01" min="0" className="field-input" />
        </div>
      </div>

      {!productId && (
        <div>
          <label className="field-label">Opening Quantity</label>
          <input {...register("openingQuantity")} type="number" step="1" min="0" className="field-input" />
        </div>
      )}

      {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{serverError}</p>}

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {isSubmitting ? (productId ? "Saving…" : "Adding…") : submitLabel}
      </button>
    </form>
  );
}
