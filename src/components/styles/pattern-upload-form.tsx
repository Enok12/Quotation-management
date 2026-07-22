"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Check, Copy, X } from "lucide-react";
import { MAX_PATTERN_FILE_BYTES } from "@/lib/pattern-upload-limits";

// Upload form for a new pattern. There is deliberately no Pattern ID field —
// the code is generated server-side on save and shown afterwards for the
// pattern maker to pass on to the admin.
export function PatternUploadForm() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      // Client-side size check purely for a fast, clear message — the server
      // re-validates everything regardless.
      for (const slot of ["picture", "file1", "file2", "file3"]) {
        const f = fd.get(slot);
        if (f instanceof File && f.size > MAX_PATTERN_FILE_BYTES) {
          throw new Error(`${slot === "picture" ? "The picture" : slot} is too large (max 10MB).`);
        }
      }

      const res = await fetch("/api/v1/patterns", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save pattern");

      setCreatedCode(json.data.patternCode);
      setDescription("");
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is on screen to read anyway */
    }
  };

  const fileField = (name: string, label: string, required: boolean, accept?: string) => (
    <div>
      <label className="field-label">
        {label} {required ? <span className="text-red-500">*</span> : <span className="text-stone-400">(optional)</span>}
      </label>
      <input
        type="file" name={name} required={required} accept={accept}
        className="block w-full text-sm text-stone-600 dark:text-stone-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-stone-100 dark:file:bg-white/10 file:text-ink hover:file:bg-stone-200 dark:hover:file:bg-white/20 file:cursor-pointer"
      />
    </div>
  );

  return (
    <div className="card card-body">
      <h2 className="heading-2 mb-4">Upload a Pattern</h2>

      {createdCode && (
        <div className="mb-4 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Check size={14} /> Pattern saved
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                Give this Pattern ID to your administrator so they can assign it to an order:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="font-mono text-lg font-semibold text-ink tracking-wider">{createdCode}</code>
                <button type="button" onClick={copyCode} className="btn-ghost text-xs py-1 px-2">
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => setCreatedCode(null)} className="text-emerald-600 hover:text-emerald-800 flex-none">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={submit} className="space-y-4">
        <div>
          <label className="field-label">Item Description <span className="text-red-500">*</span></label>
          <input
            type="text" name="description" required maxLength={500}
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Men's Slim Fit Shirt — collar variant B"
            className="field-input"
          />
        </div>

        {fileField("picture", "Picture", false, "image/*")}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fileField("file1", "File 1", true)}
          {fileField("file2", "File 2", true)}
          {fileField("file3", "File 3", true)}
        </div>
        <p className="text-xs text-stone-400">
          Files can be images or any other type (PDF, DXF, ZIP…). Max 10MB each.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {saving ? "Uploading…" : "Save Pattern"}
        </button>
      </form>
    </div>
  );
}
