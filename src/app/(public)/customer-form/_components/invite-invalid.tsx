import { AlertCircle } from "lucide-react";

// Shown when a link has no token, an unknown token, or one that is already
// used / expired. Kept deliberately vague so it can't be used to probe tokens.
// businessName is only known when the token at least resolved to a real (if
// used/expired) invite — an unknown token reveals nothing about who sent it.
export function InviteInvalid({ used = false, businessName }: { used?: boolean; businessName?: string }) {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {businessName && <p className="font-serif text-xl text-ink mb-6">{businessName}</p>}
        <AlertCircle size={44} className="text-stone-400 mx-auto mb-4" />
        <h2 className="font-serif text-2xl text-ink mb-2">Link no longer available</h2>
        <p className="text-stone-500 text-sm">
          {used
            ? "This registration link has already been used."
            : "This registration link is invalid or has expired."}{" "}
          Please contact {businessName || "the business that sent you this link"} for a new one.
        </p>
      </div>
    </main>
  );
}
