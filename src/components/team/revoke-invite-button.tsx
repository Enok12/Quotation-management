"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";

export function RevokeInviteButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const revoke = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/staff-invites/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to revoke invite");
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={revoke}
      disabled={loading}
      title="Revoke invite"
      aria-label="Revoke invite"
      className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 transition-colors p-1 disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
    </button>
  );
}
