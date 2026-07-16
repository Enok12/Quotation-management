"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Check, X } from "lucide-react";

// Generates a one-time, 48h staff-invite link (with the chosen role baked in).
export function GenerateStaffInviteButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openModal = () => {
    setOpen(true);
    setUrl(null);
    setError(null);
    setCopied(false);
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/staff-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to generate link");
      setUrl(`${window.location.origin}/join/${json.data.token}`);
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

  const close = () => {
    setOpen(false);
    if (url) router.refresh(); // a new pending invite now exists in the list below
  };

  return (
    <>
      <button onClick={openModal} className="btn-outline">
        <Link2 size={15} /> Invite Staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={close}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl text-ink">Invite a staff member</h3>
                <p className="text-sm text-stone-500 mt-0.5">One-time use · expires in 48 hours.</p>
              </div>
              <button onClick={close} className="text-stone-400 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {!url && (
              <div className="mb-4">
                <label className="field-label">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "STAFF" | "ADMIN")}
                  className="field-input"
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2 mb-4">
                {error}
              </p>
            )}

            {!url ? (
              <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center disabled:opacity-50">
                {loading ? "Generating…" : "Generate link"}
              </button>
            ) : (
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
                  Send this to one person. It works only once — after they accept, the link stops working.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
