import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateBusinessForm } from "@/components/onboarding/create-business-form";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const user = await requireUser();

  const membership = user.activeBusinessId
    ? await prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId: user.activeBusinessId, userId: user.id } },
      })
    : await prisma.businessMember.findFirst({ where: { userId: user.id } });

  if (membership) {
    // A membership exists but activeBusinessId wasn't pointing at it (e.g. it
    // was cleared) — just repoint it rather than making the user re-register.
    if (user.activeBusinessId !== membership.businessId) {
      await prisma.user.update({ where: { id: user.id }, data: { activeBusinessId: membership.businessId } });
    }
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-ink tracking-tight">MONTRA</h1>
          <p className="text-stone-500 text-sm mt-1 tracking-widest uppercase">Clothing & Manufacturing</p>
        </div>
        <div className="card card-body">
          <h2 className="font-serif text-2xl text-ink mb-1">Set up your business</h2>
          <p className="text-stone-500 text-sm mb-6">
            Create your workspace to start making receipts. You can invite staff afterward.
          </p>
          <CreateBusinessForm />
        </div>
      </div>
    </main>
  );
}
