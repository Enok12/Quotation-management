"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

export function CategoryRowActions({ id, name, productCount }: { id: string; name: string; productCount: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rename = async () => {
    if (!value.trim() || value === name) { setEditing(false); setValue(name); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/inventory/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to rename");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/categories/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to delete");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
      setLoading(false);
      setConfirmingDelete(false);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          value={value} onChange={(e) => setValue(e.target.value)} autoFocus
          className="field-input text-xs py-1 w-40"
          onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") { setEditing(false); setValue(name); } }}
        />
        <button onClick={rename} disabled={loading} className="text-emerald-600 hover:text-emerald-700 p-1">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button onClick={() => { setEditing(false); setValue(name); }} disabled={loading} className="text-stone-400 hover:text-ink p-1">
          <X size={14} />
        </button>
        {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
      </span>
    );
  }

  if (confirmingDelete) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <button type="button" onClick={remove} disabled={loading} className="text-red-600 hover:underline">
          {loading ? <Loader2 size={12} className="animate-spin inline" /> : "Delete"}
        </button>
        <button type="button" onClick={() => setConfirmingDelete(false)} disabled={loading} className="text-stone-400 hover:text-ink">Cancel</button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        onClick={() => setEditing(true)}
        title="Rename" aria-label="Rename"
        className="text-stone-400 hover:text-amber-600 dark:text-stone-500 dark:hover:text-amber-400 transition-colors p-1"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={() => setConfirmingDelete(true)}
        title={productCount > 0 ? `Delete (${productCount} product${productCount === 1 ? "" : "s"} will lose this category)` : "Delete"}
        aria-label="Delete"
        className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 transition-colors p-1"
      >
        <Trash2 size={14} />
      </button>
    </span>
  );
}
