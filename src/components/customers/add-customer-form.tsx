"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { PhoneInput } from "./phone-input";

export const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  otherPhone: z.string().optional(),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  nic: z.string().optional(),
  notes: z.string().optional(),
});
export type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface SavedCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

// Shared create/edit customer form — used inside the "Add Customer" modal,
// the "Edit Customer" modal (pass customerId to switch it into edit mode),
// and inline (pre-filled) when a receipt upload can't confidently match an
// existing customer.
export function AddCustomerForm({
  customerId,
  defaultValues,
  onCreated,
  submitLabel = "Add Customer",
}: {
  /** Present = edit an existing customer (PUT); absent = create (POST). */
  customerId?: string;
  defaultValues?: Partial<CustomerFormValues>;
  onCreated: (customer: SavedCustomer) => void;
  submitLabel?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { phone: "", otherPhone: "", ...defaultValues },
  });

  const onSubmit = async (data: CustomerFormValues) => {
    setServerError(null);
    try {
      const res = await fetch(customerId ? `/api/v1/customers/${customerId}` : "/api/v1/customers", {
        method: customerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? `Failed to ${customerId ? "save" : "add"} customer`);
      onCreated(json.data);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
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
        <label className="field-label">Other phone number</label>
        <Controller
          control={control}
          name="otherPhone"
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
        {isSubmitting ? (customerId ? "Saving…" : "Adding…") : submitLabel}
      </button>
    </form>
  );
}
