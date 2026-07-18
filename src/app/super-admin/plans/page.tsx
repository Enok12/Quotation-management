import Link from "next/link";
import { prisma } from "@/lib/db";
import { PlanForm } from "@/components/super-admin/plan-form";

export const metadata = { title: "Super Admin — Plans" };

export default async function SuperAdminPlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, enabledSections: true, _count: { select: { businesses: true } } },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Plans</h1>
        <p className="text-stone-500 text-sm mt-1">
          Each business is assigned one plan — its enabled sections control what that business can see and use.
        </p>
      </div>

      <div className="card mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Name</th>
                <th className="th text-left">Sections</th>
                <th className="th text-center">Businesses</th>
                <th className="th w-16"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-medium">{p.name}</td>
                  <td className="td text-xs text-stone-500">{p.enabledSections.length} of 9</td>
                  <td className="td text-center text-sm">{p._count.businesses}</td>
                  <td className="td">
                    <Link href={`/super-admin/plans/${p.id}`} className="text-xs text-amber-600 hover:underline">Edit →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-body">
        <h2 className="heading-2 mb-4">Create a new plan</h2>
        <PlanForm />
      </div>
    </div>
  );
}
