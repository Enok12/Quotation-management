import { AlertCircle } from "lucide-react";

// Shown for an unknown token — also naturally covers sample orders, which
// never have a tracking token, so there is nothing to look up for them. The
// token doesn't resolve to a receipt at all here, so which business it
// belongs to is unknowable — this can't be branded per-tenant.
export function TrackingInvalid() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <AlertCircle size={44} className="text-stone-400 mx-auto mb-4" />
        <h2 className="font-serif text-2xl text-ink mb-2">Tracking link not found</h2>
        <p className="text-stone-500 text-sm">
          This link is invalid, or the order isn&apos;t available for tracking. Please contact the business you ordered from for help.
        </p>
      </div>
    </main>
  );
}
