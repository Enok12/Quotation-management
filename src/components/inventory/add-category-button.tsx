"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

export function AddCategoryButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to add category");
      setOpen(false);
      setName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} /> Add Category
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-sm p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Add Category</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="field-label">Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder="e.g. T-Shirts" autoFocus />
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{error}</p>}
              <button type="submit" disabled={saving || name.trim().length === 0} className="btn-primary w-full">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Adding…" : "Add Category"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
