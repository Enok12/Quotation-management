"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2 } from "lucide-react";
import { PhoneInput } from "./phone-input";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  nic: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// Lets staff add a customer directly from the dashboard, without going
// through the one-time self-registration invite link.
export function AddCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" },
  });

  const close = () => {
    if (isSubmitting) return;
    setOpen(false);
    setServerError(null);
    reset();
  };

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to add customer");
      setOpen(false);
      reset();
      router.push(`/dashboard/customers/${json.data.id}`);
      router.refresh();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} /> Add Customer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={close}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-lg p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Add Customer</h3>
              <button onClick={close} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="field-label">Full Name *</label>
                <input {...register("name")} className="field-input" placeholder="Customer's full name" autoFocus />
                {errors.name && <p className="field-error">{errors.name.message}</p>}
              </div>

              <div>
                <label className="field-label">Phone</label>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => <PhoneInput value={field.value} onChange={field.onChange} />}
                />
              </div>

              <div>
                <label className="field-label">Email</label>
                <input {...register("email")} type="email" className="field-input" placeholder="optional" />
                {errors.email && <p className="field-error">{errors.email.message}</p>}
              </div>

              <div>
                <label className="field-label">Address</label>
                <textarea {...register("address")} rows={2} className="field-input resize-none" placeholder="optional" />
              </div>

              <div>
                <label className="field-label">NIC</label>
                <input {...register("nic")} className="field-input" placeholder="optional" />
              </div>

              <div>
                <label className="field-label">Notes</label>
                <textarea {...register("notes")} rows={2} className="field-input resize-none" placeholder="optional" />
              </div>

              {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{serverError}</p>}

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                {isSubmitting ? "Adding…" : "Add Customer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
