"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Search, FileDown, Link2, Check } from "lucide-react";

interface FoundPattern {
  id: string;
  patternCode: string;
  description: string;
  imageUrl: string | null;
  files: { url: string; name: string }[];
  createdBy: string;
  createdAt: string;
}

// Admin-facing: type a Pattern ID, see the details if it exists, then assign
// it to this order item. Lookup is a deliberate two-step (search, then
// assign) rather than assigning on match — the whole point is that the admin
// confirms it's the right style before committing.
export function AssignPatternButton({
  itemId,
  itemDescription,
  assignedCode,
}: {
  itemId: string;
  itemDescription: string;
  /** Currently-assigned pattern code, if any — shown inline on the row. */
  assignedCode?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [found, setFound] = useState<FoundPattern | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCode(""); setFound(null); setNotFound(false); setError(null);
  };

  const close = () => {
    if (searching || assigning) return;
    setOpen(false);
    reset();
  };

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSearching(true);
    setError(null);
    setNotFound(false);
    setFound(null);
    try {
      const res = await fetch(`/api/v1/patterns/lookup?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Lookup failed");
      if (json.data.found) setFound(json.data.pattern);
      else setNotFound(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSearching(false);
    }
  };

  const assign = async (patternId: string | null) => {
    setAssigning(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/receipt-items/${itemId}/pattern`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to assign pattern");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-amber-600 dark:text-stone-500 dark:hover:text-amber-400 transition-colors"
      >
        <Link2 size={12} />
        {assignedCode ? <code className="font-mono">{assignedCode}</code> : "Assign Pattern"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={close}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-serif text-xl text-ink">Assign Pattern</h3>
              <button onClick={close} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <p className="text-sm text-stone-500 mb-4 truncate">{itemDescription}</p>

            <form onSubmit={lookup} className="flex gap-2">
              <input
                type="text" autoFocus value={code}
                onChange={(e) => { setCode(e.target.value); setFound(null); setNotFound(false); }}
                placeholder="Enter Pattern ID (e.g. PTN-7K2M9Q)"
                className="field-input flex-1 font-mono"
              />
              <button type="submit" disabled={searching || !code.trim()} className="btn-outline whitespace-nowrap">
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Find
              </button>
            </form>

            {notFound && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">
                No pattern exists with that Pattern ID. Check it with whoever uploaded it.
              </p>
            )}

            {found && (
              <div className="mt-4 border border-stone-200 dark:border-stone-700 rounded-md p-3">
                <div className="flex gap-3">
                  {found.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={found.imageUrl} alt="" className="w-16 h-16 object-cover rounded border border-stone-200 dark:border-stone-700 flex-none" />
                  )}
                  <div className="min-w-0">
                    <code className="font-mono text-sm font-semibold text-ink">{found.patternCode}</code>
                    <p className="text-sm text-ink mt-0.5">{found.description}</p>
                    <p className="text-xs text-stone-400 mt-0.5">Uploaded by {found.createdBy}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 mt-2.5">
                  {found.files.map((f, i) => (
                    <a
                      key={i} href={f.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-amber-600 hover:underline truncate"
                    >
                      <FileDown size={11} className="flex-none" /> {f.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 mt-5">
              {assignedCode && (
                <button type="button" onClick={() => assign(null)} disabled={assigning} className="btn-ghost text-xs py-1.5">
                  Remove current
                </button>
              )}
              <button type="button" onClick={close} disabled={assigning} className="btn-ghost text-xs py-1.5 ml-auto">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => found && assign(found.id)}
                disabled={!found || assigning}
                className="btn-primary text-xs py-1.5 disabled:opacity-40"
              >
                {assigning ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
