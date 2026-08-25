"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

// Deletes a pattern. A Pattern Maker can only delete their own pending uploads;
// an Admin can delete any (enforced server-side). Icon-only, with an inline
// confirm to avoid an accidental click removing a reviewed pattern.
export function PatternDeleteButton({ patternId, patternCode }: { patternId: string; patternCode: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const del = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/patterns/${patternId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to delete");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <button type="button" onClick={del} disabled={loading} className="text-red-600 hover:underline">
          {loading ? <Loader2 size={12} className="animate-spin inline" /> : "Delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={loading} className="text-stone-400 hover:text-ink">Cancel</button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title={`Delete ${patternCode}`}
      aria-label={`Delete ${patternCode}`}
      className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 transition-colors p-1"
    >
      <Trash2 size={14} />
    </button>
  );
}
