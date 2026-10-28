"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name"),
  phone: z.string().refine((v) => v.replace(/\D/g, "").length >= 9, "Enter a valid phone number"),
  phone2: z.string().optional(),
  address: z.string().trim().min(1, "Please enter your delivery address"),
  city: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const money = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

interface Props {
  token: string;
  businessName: string;
  logoUrl: string | null;
  dispatchRef: string;
  items: { name: string; quantity: number; lineTotal: number }[];
  deliveryFee: number;
  codAmount: number;
  customer: { name: string; phone: string; phone2: string; address: string; city: string };
}

// The customer can fix their contact and address details and confirm — or
// decline. They cannot change the items or the amount.
export function CodConfirmClient({ token, businessName, logoUrl, dispatchRef, items, deliveryFee, codAmount, customer }: Props) {
  const [done, setDone] = useState<"confirmed" | "declined" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: customer,
  });

  const send = async (body: Record<string, unknown>, kind: "confirm" | "decline") => {
    setBusy(kind);
    setServerError(null);
    try {
      const res = await fetch(`/api/v1/cod/confirm/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Something went wrong. Please try again.");
      setDone(kind === "confirm" ? "confirmed" : "declined");
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onConfirm = (v: FormValues) =>
    send({ action: "confirm", customer: { name: v.name, phone: v.phone, phone2: v.phone2 || undefined, address: v.address, city: v.city || undefined } }, "confirm");

  if (done) {
    return (
      <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          {done === "confirmed" ? <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" /> : <XCircle size={48} className="text-stone-400 mx-auto mb-4" />}
          <h2 className="font-serif text-2xl text-ink mb-2">{done === "confirmed" ? "Order confirmed" : "Order cancelled"}</h2>
          <p className="text-stone-500 text-sm">
            {done === "confirmed"
              ? `Thank you! ${businessName} will arrange delivery. Please keep Rs. ${money(codAmount)} ready for the delivery person.`
              : `Your order ${dispatchRef} has been cancelled. Nothing is due.`}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={businessName} className="h-12 mx-auto mb-4 object-contain" />
          ) : (
            <p className="font-serif text-xl text-ink mb-4">{businessName}</p>
          )}
          <h1 className="font-serif text-2xl text-ink">Confirm your order</h1>
          <p className="text-stone-500 text-sm mt-1">Order {dispatchRef} · pay on delivery</p>
        </div>

        <div className="card p-5 mb-4">
          {items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span className="text-ink">{it.quantity} × {it.name}</span>
              <span className="font-mono">{money(it.lineTotal)}</span>
            </div>
          ))}
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm py-1 text-stone-500">
              <span>Delivery</span><span className="font-mono">{money(deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-stone-200 dark:border-stone-700 mt-2 pt-3">
            <span className="font-semibold text-ink">Pay on delivery</span>
            <span className="font-serif text-xl text-ink">Rs. {money(codAmount)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onConfirm)} className="card p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Delivery details</p>
          <div>
            <label className="field-label">Name</label>
            <input {...register("name")} className="field-input" />
            {errors.name && <p className="field-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input {...register("phone")} inputMode="tel" className="field-input" />
            {errors.phone && <p className="field-error">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="field-label">Other phone (optional)</label>
            <input {...register("phone2")} inputMode="tel" className="field-input" />
          </div>
          <div>
            <label className="field-label">Delivery address</label>
            <textarea {...register("address")} rows={3} className="field-input resize-none" />
            {errors.address && <p className="field-error">{errors.address.message}</p>}
          </div>
          <div>
            <label className="field-label">City / town (optional)</label>
            <input {...register("city")} className="field-input" />
          </div>

          {serverError && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{serverError}</p>}

          <button type="submit" disabled={busy !== null} className="btn-primary w-full">
            {busy === "confirm" && <Loader2 size={15} className="animate-spin" />} Confirm my order
          </button>
          <button
            type="button" disabled={busy !== null}
            onClick={() => { if (window.confirm("Cancel this order?")) send({ action: "decline" }, "decline"); }}
            className="w-full text-sm text-stone-400 hover:text-red-500 transition-colors"
          >
            {busy === "decline" ? "Cancelling…" : "I don't want this order"}
          </button>
        </form>
      </div>
    </main>
  );
}
