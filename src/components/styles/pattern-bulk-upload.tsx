"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { MAX_PATTERN_FILE_BYTES, MODULE_FILE_FIELD } from "@/lib/pattern-upload-limits";
import { patternCodeFromFileName } from "@/lib/utils/pattern-code";
import { runWithConcurrency } from "@/lib/utils/concurrency";

// Upload as many module (.mdl) files as you like at once. Each file's name
// becomes its Pattern ID; the pattern is created "pending review" for an admin
// to describe and finalize. One request per file (with light concurrency), so
// a big batch never trips a single-request size limit — same approach as the
// bulk receipt upload.
type Status = "uploading" | "created" | "skipped" | "failed";
interface Item {
  id: string;
  fileName: string;
  patternCode: string;
  status: Status;
  message?: string;
}

const CONCURRENCY = 3;

export function PatternBulkUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const patch = (id: string, next: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const queued: { item: Item; file: File }[] = files.map((file) => ({
      file,
      item: {
        id: crypto.randomUUID(),
        fileName: file.name,
        patternCode: patternCodeFromFileName(file.name),
        status: "uploading" as Status,
      },
    }));
    // Show the newest batch on top of any previous results.
    setItems((prev) => [...queued.map((q) => q.item), ...prev]);
    setBusy(true);

    await runWithConcurrency(queued, CONCURRENCY, 150, async ({ item, file }) => {
      if (file.size > MAX_PATTERN_FILE_BYTES) {
        patch(item.id, { status: "failed", message: "Too large (max 10MB)" });
        return;
      }
      if (!item.patternCode) {
        patch(item.id, { status: "failed", message: "Could not read a Pattern ID from the file name" });
        return;
      }
      try {
        const fd = new FormData();
        fd.append(MODULE_FILE_FIELD, file);
        const res = await fetch("/api/v1/patterns", { method: "POST", body: fd });
        const json = await res.json();
        if (json.success) {
          patch(item.id, { status: "created" });
        } else if (res.status === 409) {
          patch(item.id, { status: "skipped", message: "Already exists" });
        } else {
          patch(item.id, { status: "failed", message: json.message ?? "Upload failed" });
        }
      } catch {
        patch(item.id, { status: "failed", message: "Network error" });
      }
    });

    setBusy(false);
    router.refresh(); // reflect the newly-created pending patterns in the list below
  };

  const dot: Record<Status, string> = {
    uploading: "text-stone-400",
    created: "text-emerald-500",
    skipped: "text-amber-500",
    failed: "text-red-500",
  };

  return (
    <div className="card card-body">
      <h2 className="heading-2 mb-1">Upload Patterns</h2>
      <p className="text-xs text-stone-400 mb-4">
        Select one or more module files. Each file&apos;s name becomes its Pattern ID (e.g.
        <code className="font-mono mx-1">EC 1.mdl</code>→<code className="font-mono mx-1">EC 1</code>). Max 10MB each.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const fl = e.target.files;
          e.target.value = ""; // allow re-selecting the same files
          onFiles(fl);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg py-6 text-sm text-stone-500 hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {busy ? "Uploading…" : "Choose module files"}
      </button>

      {items.length > 0 && (
        <ul className="mt-4 space-y-1.5 max-h-64 overflow-y-auto">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-sm">
              <span className={`flex-none ${dot[it.status]}`}>
                {it.status === "uploading" && <Loader2 size={13} className="animate-spin" />}
                {it.status === "created" && <Check size={13} />}
                {it.status === "skipped" && <AlertTriangle size={13} />}
                {it.status === "failed" && <X size={13} />}
              </span>
              <code className="font-mono text-xs text-ink flex-none">{it.patternCode || "—"}</code>
              <span className="text-stone-400 text-xs truncate">{it.fileName}</span>
              {it.message && <span className="text-stone-400 text-xs ml-auto flex-none">{it.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
