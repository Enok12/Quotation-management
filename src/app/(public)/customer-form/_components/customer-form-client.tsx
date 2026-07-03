"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, Loader2 } from "lucide-react";
import { PhoneInput } from "@/components/customers/phone-input";

const schema = z.object({
  name: z.string().min(2, "Full name is required"),
  address: z.string().min(5, "Address is required"),
  phone: z.string().min(7, "Phone number is required"),
  email: z.string().email("Enter a valid email").or(z.literal("")).optional(),
});
type FormValues = z.infer<typeof schema>;

export function CustomerFormClient({ token }: { token: string }) {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    const res = await fetch("/api/v1/customers/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, token }),
    });
    const json = await res.json();
    if (json.success) setSuccess(true);
    else setServerError(json.message ?? "Something went wrong. Please try again.");
  };

  if (success) {
    return (
      <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="font-serif text-2xl text-ink mb-2">Thank you!</h2>
          <p className="text-stone-500 text-sm">
            Your details have been received. MONTRA will be in touch with you shortly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/montra-wordmark.png" alt="MONTRA" className="h-10 mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-ink">Customer Registration</h1>
          <p className="text-stone-500 text-sm mt-1">Fill in your details and we'll follow up with you.</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="card-body space-y-5">
            <div>
              <label className="field-label">Full Name *</label>
              <input {...register("name")} className="field-input" placeholder="Your full name" />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>

            <div>
              <label className="field-label">Address *</label>
              <textarea {...register("address")} rows={2} className="field-input resize-none" placeholder="Your address" />
              {errors.address && <p className="field-error">{errors.address.message}</p>}
            </div>

            <div>
              <label className="field-label">Phone Number *</label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput value={field.value} onChange={field.onChange} error={!!errors.phone} />
                )}
              />
              {errors.phone && <p className="field-error">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="field-label">Email</label>
              <input {...register("email")} type="email" className="field-input" placeholder="optional" />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2">{serverError}</p>}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting ? "Submitting…" : "Submit Details"}
            </button>

            <p className="text-center text-xs text-stone-400">
              By submitting, you agree to MONTRA's{" "}
              <a href="#" className="underline hover:text-stone-600">Terms & Conditions</a>.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
