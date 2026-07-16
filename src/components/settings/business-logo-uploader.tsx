"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Loader2 } from "lucide-react";

export function BusinessLogoUploader({ initialLogoUrl }: { initialLogoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/business/logo", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to upload logo");
      setLogoUrl(json.data.logoUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/business/logo", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to remove logo");
      setLogoUrl(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove logo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 flex items-center justify-center overflow-hidden flex-none">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Business logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-stone-300 dark:text-stone-600 text-[10px] text-center px-1">No logo set</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="btn-outline disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {logoUrl ? "Replace logo" : "Upload logo"}
          </button>
          {logoUrl && (
            <button type="button" onClick={remove} disabled={loading} className="btn-ghost text-red-500 disabled:opacity-50">
              <Trash2 size={14} /> Remove logo
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-stone-400">PNG or JPEG · max 3MB. Shown on receipt PDFs and customer-facing pages.</p>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
