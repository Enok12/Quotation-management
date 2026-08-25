"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Pencil, Check } from "lucide-react";
import { MAX_PATTERN_FILE_BYTES } from "@/lib/pattern-upload-limits";

// Admin review: add a description (required) + optional picture to a pattern and
// finalize it so it becomes assignable. The same modal edits an already-
// finalized pattern (it just stays finalized).
export function PatternReviewButton({
  patternId,
  patternCode,
  currentDescription,
  finalized,
}: {
  patternId: string;
  patternCode: string;
  currentDescription?: string | null;
  finalized: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(currentDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picture, setPicture] = useState<File | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (picture && picture.size > MAX_PATTERN_FILE_BYTES) throw new Error("The picture is too large (max 10MB).");
      const fd = new FormData();
      fd.append("description", description);
      if (picture) fd.append("picture", picture);
      const res = await fetch(`/api/v1/patterns/${patternId}`, { method: "PATCH", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={finalized ? "btn-ghost text-xs py-1" : "btn-amber text-xs py-1"}
      >
        <Pencil size={12} /> {finalized ? "Edit" : "Review"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl text-ink">{finalized ? "Edit pattern" : "Review pattern"}</h3>
                <code className="font-mono text-sm text-stone-500">{patternCode}</code>
              </div>
              <button onClick={() => !saving && setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="field-label">Description <span className="text-red-500">*</span></label>
                <input
                  type="text" required maxLength={500}
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Men's Slim Fit Shirt — collar variant B"
                  className="field-input"
                  autoFocus
                />
              </div>

              <div>
                <label className="field-label">Picture <span className="text-stone-400">(optional)</span></label>
                <input
                  type="file" accept="image/*"
                  onChange={(e) => setPicture(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-stone-600 dark:text-stone-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-stone-100 dark:file:bg-white/10 file:text-ink hover:file:bg-stone-200 dark:hover:file:bg-white/20 file:cursor-pointer"
                />
                {finalized && <p className="text-xs text-stone-400 mt-1">Leave empty to keep the current picture.</p>}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn-ghost text-xs py-1.5">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {finalized ? "Save changes" : "Finalize"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
