"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { AnimatedCheckbox } from "@/components/ui/animated-checkbox";
import { ALL_SECTIONS, SECTION_LABELS } from "@/lib/sections";

export function PlanForm({
  planId,
  initialName = "",
  initialSections = [],
}: {
  /** Omit to create a new plan instead of editing an existing one. */
  planId?: string;
  initialName?: string;
  initialSections?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [sections, setSections] = useState<Set<string>>(new Set(initialSections));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (s: string) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
    setSaved(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const url = planId ? `/api/v1/super-admin/plans/${planId}` : "/api/v1/super-admin/plans";
      const res = await fetch(url, {
        method: planId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), enabledSections: Array.from(sections) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save plan");
      if (planId) {
        setSaved(true);
        router.refresh();
      } else {
        router.push("/super-admin/plans");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="field-label">Plan name</label>
        <input
          required minLength={2} maxLength={60}
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          className="field-input"
          placeholder="e.g. Basic, Pro, Full Access"
        />
      </div>

      <div>
        <label className="field-label">Enabled sections</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
          {ALL_SECTIONS.map((s) => (
            <AnimatedCheckbox key={s} checked={sections.has(s)} onChange={() => toggle(s)} label={SECTION_LABELS[s]} />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading || name.trim().length < 2} className="btn-primary disabled:opacity-50">
          {loading ? "Saving…" : planId ? "Save changes" : "Create plan"}
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
