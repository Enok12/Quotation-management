import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { PlanForm } from "@/components/super-admin/plan-form";

interface Props { params: Promise<{ id: string }> }
export const metadata = { title: "Super Admin — Edit Plan" };

export default async function SuperAdminPlanPage({ params }: Props) {
  const { id } = await params;
  const plan = await prisma.plan.findUnique({ where: { id }, select: { id: true, name: true, enabledSections: true } });
  if (!plan) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <Link href="/super-admin/plans" className="btn-ghost text-xs mb-6 inline-flex">
        <ArrowLeft size={14} /> Plans
      </Link>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">{plan.name}</h1>
      </div>
      <div className="card card-body">
        <PlanForm planId={plan.id} initialName={plan.name} initialSections={plan.enabledSections} />
      </div>
    </div>
  );
}
