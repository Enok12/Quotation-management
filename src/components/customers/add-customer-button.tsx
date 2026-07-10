"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { AddCustomerForm } from "./add-customer-form";

// Lets staff add a customer directly from the dashboard, without going
// through the one-time self-registration invite link.
export function AddCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} /> Add Customer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-lg p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Add Customer</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <AddCustomerForm
              onCreated={(customer) => {
                setOpen(false);
                router.push(`/dashboard/customers/${customer.id}`);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
