import { AlertCircle } from "lucide-react";

// Shown for an unknown token — also naturally covers sample orders, which
// never have a tracking token, so there is nothing to look up for them.
export function TrackingInvalid() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/montra-wordmark.png" alt="MONTRA" className="h-9 mx-auto mb-6" />
        <AlertCircle size={44} className="text-stone-400 mx-auto mb-4" />
        <h2 className="font-serif text-2xl text-ink mb-2">Tracking link not found</h2>
        <p className="text-stone-500 text-sm">
          This link is invalid, or the order isn&apos;t available for tracking. Please contact MONTRA for help.
        </p>
      </div>
    </main>
  );
}
