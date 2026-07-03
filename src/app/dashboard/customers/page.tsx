import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { fmtDate } from "@/lib/utils/format";
import { CustomerSearch } from "@/components/customers/customer-search";
import { GenerateInviteButton } from "@/components/customers/generate-invite-button";
import { LinkButton } from "@/components/ui/link-button";

interface Props {
  searchParams: Promise<{ page?: string; search?: string; sortBy?: string; sortDir?: string }>;
}

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 20;
  const search = sp.search?.trim() ?? "";
  const sortBy = (sp.sortBy ?? "createdAt") as "name" | "createdAt" | "phone";
  const sortDir = (sp.sortDir ?? "desc") as "asc" | "desc";

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, phone: true, email: true, nic: true, createdAt: true,
        _count: { select: { receipts: true } },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink">Customers</h1>
          <p className="text-stone-500 text-sm mt-1">{total.toLocaleString()} total</p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateInviteButton />
          <LinkButton href="/dashboard/receipts/new" className="btn-primary" icon={<Plus size={15} />}>
            New Receipt
          </LinkButton>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <CustomerSearch defaultValue={search} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Name</th>
                <th className="th text-left">Phone</th>
                <th className="th text-left">Email</th>
                <th className="th text-left">NIC</th>
                <th className="th text-center">Receipts</th>
                <th className="th text-left">Added</th>
                <th className="th w-16"></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="td text-center text-stone-400 py-10">
                    {search ? `No customers matching "${search}"` : "No customers yet."}
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-medium">
                    <Link href={`/dashboard/customers/${c.id}`} className="hover:text-amber-600 transition-colors">
                      {c.name}
                    </Link>
                  </td>
                  <td className="td text-stone-500 font-mono text-xs">{c.phone ?? "—"}</td>
                  <td className="td text-stone-500 text-xs">{c.email ?? "—"}</td>
                  <td className="td text-stone-500 font-mono text-xs">{c.nic ?? "—"}</td>
                  <td className="td text-center">
                    <span className="text-xs font-semibold text-stone-600">{c._count.receipts}</span>
                  </td>
                  <td className="td text-stone-400 text-xs">{fmtDate(c.createdAt)}</td>
                  <td className="td">
                    <LinkButton href={`/dashboard/receipts/new?customerId=${c.id}`} className="btn-ghost text-xs py-1" iconSize={12}>
                      + Receipt
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
            <span className="text-stone-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/dashboard/customers?page=${page - 1}&search=${search}`}
                  className="btn-outline text-xs py-1.5"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/dashboard/customers?page=${page + 1}&search=${search}`}
                  className="btn-outline text-xs py-1.5"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
