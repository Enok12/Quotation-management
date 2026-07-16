import { SignUp } from "@clerk/nextjs";

// Two ways in: a new business owner signs up here directly (landing on
// /onboarding to name their business), or someone follows a staff invite
// link (/join/[token]) which sends them here first if they aren't signed in
// yet, then redirects back to redeem it once they are.
export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-ink tracking-tight">MONTRA</h1>
          <p className="text-stone-500 text-sm mt-1 tracking-widest uppercase">Clothing & Manufacturing</p>
        </div>
        <SignUp
          fallbackRedirectUrl="/onboarding"
          appearance={{
            elements: {
              rootBox: "w-full flex justify-center",
              cardBox: "w-full shadow-xl rounded-lg border border-stone-200 dark:border-stone-700",
              card: "bg-white dark:bg-stone-800",
              headerTitle: "text-ink font-serif",
              headerSubtitle: "text-stone-500",
              formButtonPrimary: "bg-amber-400 text-stone-900 hover:bg-amber-300 font-semibold",
              formFieldLabel: "text-stone-600",
            },
          }}
        />
      </div>
    </main>
  );
}
