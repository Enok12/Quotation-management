import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-stone-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-white tracking-tight">MONTRA</h1>
          <p className="text-stone-400 text-sm mt-1 tracking-widest uppercase">Clothing & Manufacturing</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-2xl rounded-lg border border-stone-700 bg-stone-800",
              headerTitle: "text-white font-serif",
              headerSubtitle: "text-stone-400",
              formButtonPrimary: "bg-amber-400 text-ink hover:bg-amber-300 font-semibold",
              formFieldInput: "bg-stone-700 border-stone-600 text-white placeholder:text-stone-500",
              formFieldLabel: "text-stone-300",
              footerActionLink: "text-amber-400",
            },
          }}
        />
      </div>
    </main>
  );
}
