import { ShieldOff } from "lucide-react";

// Self-service sign-up is intentionally disabled — MONTRA is an internal
// staff tool, not a public product. Accounts are created by an administrator
// (via the Clerk dashboard), never by visitors. This route is kept (rather
// than removed) so a stray /sign-up link or bookmark shows a clear message
// instead of a 404 or, worse, a working registration form.
export default function SignUpDisabledPage() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="font-serif text-4xl text-ink tracking-tight mb-1">MONTRA</h1>
        <p className="text-stone-500 text-sm tracking-widest uppercase mb-8">Clothing & Manufacturing</p>
        <ShieldOff size={44} className="text-stone-400 mx-auto mb-4" />
        <h2 className="font-serif text-2xl text-ink mb-2">Sign-up is disabled</h2>
        <p className="text-stone-500 text-sm">
          MONTRA accounts are created by an administrator. If you're staff and need access,
          contact your administrator directly.
        </p>
      </div>
    </main>
  );
}
