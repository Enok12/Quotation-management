"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { fmtDate } from "@/lib/utils/format";
import { StageTimeline } from "./_components/stage-timeline";

interface TrackResult {
  receiptNumber: number;
  custName: string;
  date: string;
  orderStatus: string;
  stageDates: Record<string, string>;
}

export default function TrackPortalPage() {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNumber = number.trim();
    const trimmedPhone = phone.trim();
    setError(null);
    setResult(null);
    if (!trimmedNumber) { setError("Enter your invoice number."); return; }
    if (!/^\d{4}$/.test(trimmedPhone)) { setError("Enter the last 4 digits of your phone number."); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams({ number: trimmedNumber, phone: trimmedPhone });
      const res = await fetch(`/api/v1/track?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Order not found");
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/montra-wordmark.png" alt="MONTRA" className="h-9 mx-auto mb-6" />
          <h1 className="font-serif text-2xl text-ink">Track Your Order</h1>
          <p className="text-stone-500 text-sm mt-1">Enter your invoice number and phone number to see production status.</p>
        </div>

        <form onSubmit={submit} className="card card-body space-y-3">
          <div>
            <label className="field-label">Invoice Number</label>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="e.g. 14"
              inputMode="numeric"
              className="field-input"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Last 4 Digits of Phone Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="e.g. 1234"
              inputMode="numeric"
              maxLength={4}
              className="field-input"
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {loading ? "Searching…" : "Track Order"}
          </button>
        </form>

        {result && (
          <div className="card card-body mt-6">
            <p className="text-sm text-stone-500 mb-5">
              Invoice #{result.receiptNumber} · {result.custName} · {fmtDate(result.date)}
            </p>
            <StageTimeline currentStatus={result.orderStatus} stageDates={result.stageDates} />
          </div>
        )}
      </div>
    </main>
  );
}
