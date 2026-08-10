"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Check, X } from "lucide-react";
import { MAX_PATTERN_FILE_BYTES, MODULE_FILE_FIELD } from "@/lib/pattern-upload-limits";

// Upload form for a new pattern. The pattern maker enters their own Pattern ID
// (must be unique), a description, one required Module (.mdl) file, and an
// optional reference picture.
export function PatternUploadForm() {
  const router = useRouter();
  const [patternCode, setPatternCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The just-saved Pattern ID, echoed back so the pattern maker can confirm/pass it on.
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      // Client-side size check purely for a fast, clear message — the server
      // re-validates everything regardless.
      for (const [field, label] of [[MODULE_FILE_FIELD, "The Module file"], ["picture", "The picture"]] as const) {
        const f = fd.get(field);
        if (f instanceof File && f.size > MAX_PATTERN_FILE_BYTES) throw new Error(`${label} is too large (max 10MB).`);
      }

      const res = await fetch("/api/v1/patterns", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save pattern");

      setSavedCode(json.data.patternCode);
      setPatternCode("");
      setDescription("");
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card card-body">
      <h2 className="heading-2 mb-4">Upload a Pattern</h2>

      {savedCode && (
        <div className="mb-4 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Check size={14} /> Pattern <code className="font-mono font-semibold">{savedCode}</code> saved.
            </p>
            <button type="button" onClick={() => setSavedCode(null)} className="text-emerald-600 hover:text-emerald-800 flex-none">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={submit} className="space-y-4">
        <div>
          <label className="field-label">Pattern ID <span className="text-red-500">*</span></label>
          <input
            type="text" name="patternCode" required maxLength={40}
            value={patternCode} onChange={(e) => setPatternCode(e.target.value)}
            placeholder="e.g. SHIRT-A17"
            className="field-input font-mono"
          />
          <p className="text-xs text-stone-400 mt-1">Your own unique ID for this pattern. Not case-sensitive.</p>
        </div>

        <div>
          <label className="field-label">Item Description <span className="text-red-500">*</span></label>
          <input
            type="text" name="description" required maxLength={500}
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Men's Slim Fit Shirt — collar variant B"
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label">Module file <span className="text-red-500">*</span></label>
          <input
            type="file" name={MODULE_FILE_FIELD} required
            className="block w-full text-sm text-stone-600 dark:text-stone-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-stone-100 dark:file:bg-white/10 file:text-ink hover:file:bg-stone-200 dark:hover:file:bg-white/20 file:cursor-pointer"
          />
          <p className="text-xs text-stone-400 mt-1">The .mdl module file. Any file type is accepted; max 10MB.</p>
        </div>

        <div>
          <label className="field-label">Picture <span className="text-stone-400">(optional)</span></label>
          <input
            type="file" name="picture" accept="image/*"
            className="block w-full text-sm text-stone-600 dark:text-stone-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-stone-100 dark:file:bg-white/10 file:text-ink hover:file:bg-stone-200 dark:hover:file:bg-white/20 file:cursor-pointer"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {saving ? "Uploading…" : "Save Pattern"}
        </button>
      </form>
    </div>
  );
}
