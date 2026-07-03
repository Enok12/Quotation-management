"use client";

import { useState } from "react";
import { MapPin, Copy, Check, X } from "lucide-react";

// Shows the permanent public tracking link for a bulk order's trackingToken.
// No generation step — the token already exists on the receipt.
export function TrackingLinkButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/track/${token}` : "";

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-outline">
        <MapPin size={14} /> Tracking Link
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl text-ink">Order tracking link</h3>
                <p className="text-sm text-stone-500 mt-0.5">Shows production status only — no pricing or payment info.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink">
                <X size={18} />
              </button>
            </div>

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
              Send this to the customer. It stays valid for the life of the order — share it any time.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
