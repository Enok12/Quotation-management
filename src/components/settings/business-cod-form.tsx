"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

export function BusinessCodForm({
  initialEnabled,
  initialThreshold,
}: {
  initialEnabled: boolean;
  initialThreshold: number;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [threshold, setThreshold] = useState(String(initialThreshold));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = enabled !== initialEnabled || Number(threshold) !== initialThreshold;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/business/cod-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codEnabled: enabled, codRefusalWarnThreshold: Number(threshold) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox" checked={enabled} className="mt-1"
          onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }}
        />
        <span>
          <span className="block text-sm font-medium text-ink">Enable Cash on Delivery for Retail sales</span>
          <span className="block text-xs text-stone-400">
            Adds a &quot;COD Orders&quot; page and a Cash on Delivery option when recording a sale.
            Turning it off hides them; existing COD orders are kept.
          </span>
        </span>
      </label>

      <div>
        <label className="field-label">Warn about customers who refused earlier orders</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-500">after</span>
          <input
            type="number" min={1} max={20} step={1} value={threshold}
            onChange={(e) => { setThreshold(e.target.value); setSaved(false); }}
            className="field-input w-20"
          />
          <span className="text-sm text-stone-500">refused COD order(s) on the same phone number</span>
        </div>
        <p className="text-xs text-stone-400 mt-1">Only a warning when you create an order — it never blocks a sale.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button disabled={loading || !dirty} className="btn-primary disabled:opacity-40">Save</button>
        {saved && <span className="text-sm text-emerald-600 inline-flex items-center gap-1"><Check size={14} /> Saved</span>}
      </div>
    </form>
  );
}
