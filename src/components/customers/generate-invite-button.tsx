"use client";

import { useState } from "react";
import { Link2, Copy, Check, X } from "lucide-react";

// Generates a one-time, 48h customer-registration link and shows a copyable URL.
export function GenerateInviteButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setUrl(null);
    setCopied(false);
    try {
      const res = await fetch("/api/v1/customer-invites", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to generate link");
      setUrl(`${window.location.origin}/customer-form/${json.data.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate link");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button onClick={generate} className="btn-outline">
        <Link2 size={15} /> Registration Link
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl text-ink">Customer registration link</h3>
                <p className="text-sm text-stone-500 mt-0.5">One-time use · expires in 48 hours.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {loading && <p className="text-sm text-stone-500 py-6 text-center">Generating…</p>}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2">
                {error}
              </p>
            )}

            {url && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="field-input text-xs flex-1"
                  />
                  <button onClick={copy} className="btn-primary whitespace-nowrap">
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
                <p className="text-xs text-stone-400 mt-3">
                  Send this to one customer. It works only once — after they submit their details,
                  the link stops working.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
