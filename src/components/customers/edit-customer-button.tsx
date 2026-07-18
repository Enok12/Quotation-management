"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { AddCustomerForm, type CustomerFormValues } from "./add-customer-form";

// Opens the same form used to create a customer, pre-filled and pointed at
// the update endpoint (see AddCustomerForm's customerId prop) — stays on the
// current page and refreshes on save, rather than redirecting like creation does.
export function EditCustomerButton({
  customerId,
  defaultValues,
}: {
  customerId: string;
  defaultValues: Partial<CustomerFormValues>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-outline">
        <Pencil size={14} /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-lg p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Edit Customer</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <AddCustomerForm
              customerId={customerId}
              defaultValues={defaultValues}
              submitLabel="Save Changes"
              onCreated={() => {
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
