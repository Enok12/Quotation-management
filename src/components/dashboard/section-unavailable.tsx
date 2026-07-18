import { Lock } from "lucide-react";

// Shown instead of a page's real content when its Section isn't included in
// the business's current plan (or its subscription has lapsed) — never a raw
// error, always this same clear, on-brand message.
export function SectionUnavailable({ section }: { section: string }) {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-2xl">
      <div className="card card-body text-center py-16">
        <Lock size={40} className="text-stone-300 mx-auto mb-4" />
        <h1 className="font-serif text-2xl text-ink mb-2">{section} isn&apos;t available</h1>
        <p className="text-stone-500 text-sm">
          This section isn&apos;t included in your business&apos;s current plan. Contact your administrator to upgrade.
        </p>
      </div>
    </div>
  );
}
