"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinBusinessButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/staff-invites/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to join");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2 mb-4">
          {error}
        </p>
      )}
      <button onClick={join} disabled={loading} className="btn-primary w-full justify-center disabled:opacity-50">
        {loading ? "Joining…" : "Accept invite"}
      </button>
    </>
  );
}
