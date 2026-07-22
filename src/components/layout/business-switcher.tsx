"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";

export interface Membership {
  businessId: string;
  name: string;
  /** Mirrors the Role enum — a user's role can differ per business, and a
   * narrow role like PATTERN_MAKER is just as valid here as ADMIN/STAFF. */
  role: "ADMIN" | "STAFF" | "PATTERN_MAKER";
  active: boolean;
}

// Only ever shown when the user belongs to more than one business — the
// common single-business case stays exactly as it was. Switching just moves
// the activeBusinessId pointer; every membership (and its data) stays intact,
// so this is always safe and reversible.
export function BusinessSwitcher({ memberships }: { memberships: Membership[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (memberships.length <= 1) return null;
  const current = memberships.find((m) => m.active) ?? memberships[0];

  const switchTo = async (businessId: string) => {
    setOpen(false);
    if (businessId === current.businessId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/business/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to switch business");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to switch business");
    } finally {
      // The sidebar lives in the persistent dashboard layout, so router.refresh()
      // doesn't remount this component — loading has to be cleared explicitly
      // on the success path too, not just on error.
      setLoading(false);
    }
  };

  return (
    <div className="relative px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs text-stone-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        <span className="truncate">
          {loading ? "Switching…" : <>Switch business <span className="text-stone-600">·</span> {current.name}</>}
        </span>
        {loading ? <Loader2 size={12} className="animate-spin flex-none" /> : <ChevronsUpDown size={12} className="flex-none" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-stone-800 border border-white/10 rounded-lg shadow-xl py-1 z-50">
            {memberships.map((m) => (
              <button
                key={m.businessId}
                type="button"
                onClick={() => switchTo(m.businessId)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-stone-200 hover:bg-white/5 transition-colors text-left"
              >
                <span className="truncate">
                  {m.name} <span className="text-stone-500">· {m.role === "ADMIN" ? "Admin" : "Staff"}</span>
                </span>
                {m.businessId === current.businessId && <Check size={12} className="text-emerald-400 flex-none" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
