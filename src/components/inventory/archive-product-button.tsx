"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";

// Soft delete — keeps the product's stock-movement history intact server-side.
export function ArchiveProductButton({ productId, sku }: { productId: string; sku: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const archive = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/products/${productId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to archive");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to archive");
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <button type="button" onClick={archive} disabled={loading} className="text-red-600 hover:underline">
          {loading ? <Loader2 size={12} className="animate-spin inline" /> : "Archive"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={loading} className="text-stone-400 hover:text-ink">Cancel</button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title={`Archive ${sku}`}
      aria-label={`Archive ${sku}`}
      className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 transition-colors p-1"
    >
      <Archive size={14} />
    </button>
  );
}
