import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { ForbiddenError } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let businessId: string, role: string, userId: string;
  try {
    ({ businessId, role, id: userId } = await requireBusiness());
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/onboarding");
    throw err;
  }

  const [business, memberships] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, logoUrl: true } }),
    prisma.businessMember.findMany({
      where: { userId },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <DashboardShell
      businessName={business.name}
      logoUrl={business.logoUrl}
      memberships={memberships.map((m) => ({ businessId: m.businessId, name: m.business.name, role: m.role, active: m.businessId === businessId }))}
      items={[
        { href: "/dashboard", icon: "LayoutDashboard", label: "Dashboard", exact: true },
        { href: "/dashboard/customers", icon: "Users", label: "Customers" },
        { href: "/dashboard/receipts", icon: "FileText", label: "Receipts" },
        { href: "/dashboard/payments", icon: "Wallet", label: "Orders" },
        { href: "/dashboard/orders", icon: "Package", label: "Production" },
        { href: "/dashboard/expenses", icon: "Banknote", label: "Expenses" },
        { href: "/dashboard/income", icon: "TrendingUp", label: "Income" },
        { href: "/dashboard/team", icon: "UserCog", label: "Team" },
        { href: "/dashboard/audit", icon: "ClipboardList", label: "Audit Log" },
        ...(role === "ADMIN" ? [{ href: "/dashboard/settings", icon: "Settings", label: "Settings" } as const] : []),
      ]}
    >
      {children}
    </DashboardShell>
  );
}
