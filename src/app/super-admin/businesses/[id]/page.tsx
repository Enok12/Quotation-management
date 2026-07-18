import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { BusinessPlanForm } from "@/components/super-admin/business-plan-form";

interface Props { params: Promise<{ id: string }> }
export const metadata = { title: "Super Admin — Business" };

export default async function SuperAdminBusinessPage({ params }: Props) {
  const { id } = await params;
  const [business, plans] = await Promise.all([
    prisma.business.findUnique({
      where: { id },
      select: {
        id: true, name: true, planId: true, subscriptionStatus: true, subscriptionRenewsAt: true,
        members: { select: { role: true, user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.plan.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!business) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <Link href="/super-admin" className="btn-ghost text-xs mb-6 inline-flex">
        <ArrowLeft size={14} /> Businesses
      </Link>

      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">{business.name}</h1>
        <p className="text-stone-500 text-sm mt-1">{business.members.length} member{business.members.length === 1 ? "" : "s"}</p>
      </div>

      <div className="card card-body mb-6">
        <h2 className="heading-2 mb-4">Plan &amp; subscription</h2>
        <BusinessPlanForm
          businessId={business.id}
          plans={plans}
          initialPlanId={business.planId}
          initialStatus={business.subscriptionStatus}
          initialRenewsAt={business.subscriptionRenewsAt ? business.subscriptionRenewsAt.toISOString().slice(0, 10) : ""}
        />
      </div>

      <div className="card">
        <div className="card-header"><h2 className="text-sm font-semibold text-ink">Members</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Name</th>
                <th className="th text-left">Email</th>
                <th className="th text-left">Role</th>
              </tr>
            </thead>
            <tbody>
              {business.members.map((m, i) => (
                <tr key={i}>
                  <td className="td">{m.user.name ?? "—"}</td>
                  <td className="td text-stone-500 text-xs">{m.user.email}</td>
                  <td className="td text-xs font-semibold uppercase tracking-wide text-stone-500">{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
