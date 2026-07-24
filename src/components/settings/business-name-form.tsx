"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

export function BusinessNameForm({
  initialName,
  initialNotificationEmail,
}: {
  initialName: string;
  initialNotificationEmail: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [notificationEmail, setNotificationEmail] = useState(initialNotificationEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== initialName || notificationEmail.trim() !== initialNotificationEmail;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), notificationEmail: notificationEmail.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="field-label">Business name</label>
        <input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          className="field-input"
        />
      </div>

      <div>
        <label className="field-label">Notification email</label>
        <input
          type="email"
          value={notificationEmail}
          onChange={(e) => { setNotificationEmail(e.target.value); setSaved(false); }}
          placeholder="you@example.com"
          className="field-input"
        />
        <p className="text-xs text-stone-400 mt-1">
          Where we email you when a customer registers through your registration link. Leave blank to turn these off.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-4 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || name.trim().length < 2 || !dirty}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
