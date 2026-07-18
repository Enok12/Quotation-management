import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/utils/format";

export const metadata = { title: "Super Admin — Businesses" };

export default async function SuperAdminBusinessesPage() {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, subscriptionStatus: true, createdAt: true,
      plan: { select: { name: true } },
      _count: { select: { members: true, receipts: true } },
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Businesses</h1>
        <p className="text-stone-500 text-sm mt-1">{businesses.length} on the platform</p>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Name</th>
                <th className="th text-left">Plan</th>
                <th className="th text-left">Subscription</th>
                <th className="th text-center">Members</th>
                <th className="th text-center">Receipts</th>
                <th className="th text-left">Created</th>
                <th className="th w-24"></th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-medium">{b.name}</td>
                  <td className="td text-sm">{b.plan.name}</td>
                  <td className="td">
                    <span className={
                      b.subscriptionStatus === "ACTIVE" ? "badge badge-paid"
                      : b.subscriptionStatus === "TRIAL" ? "badge badge-pending"
                      : "badge badge-unpaid"
                    }>
                      {b.subscriptionStatus}
                    </span>
                  </td>
                  <td className="td text-center text-sm">{b._count.members}</td>
                  <td className="td text-center text-sm">{b._count.receipts}</td>
                  <td className="td text-stone-400 text-xs">{fmtDateTime(b.createdAt)}</td>
                  <td className="td">
                    <Link href={`/super-admin/businesses/${b.id}`} className="text-xs text-amber-600 hover:underline">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
