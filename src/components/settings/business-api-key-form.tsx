"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Trash2 } from "lucide-react";

export function BusinessApiKeyForm({ hasCustomApiKey }: { hasCustomApiKey: boolean }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/business/gemini-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save key");
      setApiKey("");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/business/gemini-key", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to remove key");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <KeyRound size={15} className="text-stone-400" />
        {hasCustomApiKey ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Using your own API key</span>
        ) : (
          <span className="text-stone-500">Using the shared default key</span>
        )}
      </div>

      <form onSubmit={save} className="flex items-start gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
          placeholder={hasCustomApiKey ? "Replace with a new key…" : "Paste your Gemini API key…"}
          className="field-input flex-1"
          autoComplete="off"
        />
        <button type="submit" disabled={loading || apiKey.trim().length < 10} className="btn-primary disabled:opacity-50 whitespace-nowrap">
          {loading ? "Checking…" : "Save"}
        </button>
      </form>

      {hasCustomApiKey && (
        <button type="button" onClick={remove} disabled={loading} className="btn-ghost text-red-500 disabled:opacity-50">
          <Trash2 size={14} /> Remove key (use shared default instead)
        </button>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
          <Check size={14} /> Key saved and verified
        </p>
      )}

      <p className="text-xs text-stone-400">
        Get a free key from{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline hover:text-stone-600">
          Google AI Studio
        </a>. Stored encrypted — never shown again once saved.
      </p>
    </div>
  );
}
