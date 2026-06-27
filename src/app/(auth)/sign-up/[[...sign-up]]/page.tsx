import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-ink tracking-tight">MONTRA</h1>
          <p className="text-stone-500 text-sm mt-1 tracking-widest uppercase">Clothing & Manufacturing</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full flex justify-center",
              cardBox: "w-full shadow-xl rounded-lg border border-stone-200",
              card: "bg-white",
              headerTitle: "text-ink font-serif",
              headerSubtitle: "text-stone-500",
              formButtonPrimary: "bg-amber-400 text-ink hover:bg-amber-300 font-semibold",
              formFieldLabel: "text-stone-600",
              footerActionLink: "text-amber-600 hover:text-amber-500",
            },
          }}
        />
      </div>
    </main>
  );
}
