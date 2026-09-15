"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { ProductForm, type ProductFormValues } from "./product-form";

export function EditProductButton({
  productId,
  defaultValues,
}: {
  productId: string;
  defaultValues: Partial<ProductFormValues>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit"
        aria-label="Edit"
        className="text-stone-400 hover:text-amber-600 dark:text-stone-500 dark:hover:text-amber-400 transition-colors p-1"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-lg p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Edit Product</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <ProductForm
              productId={productId}
              defaultValues={defaultValues}
              submitLabel="Save Changes"
              onSaved={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
