"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

const STATUSES = ["ACTIVE", "TRIAL", "EXPIRED", "CANCELLED"] as const;

export function BusinessPlanForm({
  businessId,
  plans,
  initialPlanId,
  initialStatus,
  initialRenewsAt,
}: {
  businessId: string;
  plans: { id: string; name: string }[];
  initialPlanId: string;
  initialStatus: (typeof STATUSES)[number];
  initialRenewsAt: string;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState(initialPlanId);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(initialStatus);
  const [renewsAt, setRenewsAt] = useState(initialRenewsAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/v1/super-admin/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          subscriptionStatus: status,
          subscriptionRenewsAt: renewsAt ? new Date(renewsAt).toISOString() : null,
        }),
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
      <div>
        <label className="field-label">Plan</label>
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="field-input">
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className="field-label">Subscription status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])} className="field-input">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="field-label">Renews / expires on (optional)</label>
        <input type="date" value={renewsAt} onChange={(e) => setRenewsAt(e.target.value)} className="field-input" />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
