import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { ForbiddenError } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let businessId: string, role: string, userId: string;
  try {
    ({ businessId, role, id: userId } = await requireBusiness());
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/onboarding");
    throw err;
  }

  const [business, memberships, access] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true, logoUrl: true } }),
    prisma.businessMember.findMany({
      where: { userId },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getBusinessAccess(businessId),
  ]);

  // Each nav item's gating Section — null means always shown (never gated).
  const allNavItems = [
    { href: "/dashboard", icon: "LayoutDashboard", label: "Dashboard", exact: true, section: null },
    { href: "/dashboard/customers", icon: "Users", label: "Customers", section: "CUSTOMERS" },
    { href: "/dashboard/receipts", icon: "FileText", label: "Receipts", section: "RECEIPTS" },
    { href: "/dashboard/payments", icon: "Wallet", label: "Orders", section: "ORDERS" },
    { href: "/dashboard/orders", icon: "Package", label: "Production", section: "PRODUCTION" },
    { href: "/dashboard/expenses", icon: "Banknote", label: "Expenses", section: "EXPENSES" },
    { href: "/dashboard/income", icon: "TrendingUp", label: "Income", section: "INCOME" },
    { href: "/dashboard/team", icon: "UserCog", label: "Team", section: "TEAM" },
    { href: "/dashboard/audit", icon: "ClipboardList", label: "Audit Log", section: "AUDIT_LOG" },
    ...(role === "ADMIN" ? [{ href: "/dashboard/settings", icon: "Settings", label: "Settings", section: "SETTINGS" }] as const : []),
  ] as const;

  const items = allNavItems
    .filter((item) => item.section === null || hasSection(access, item.section))
    .map(({ section, ...item }) => item);

  return (
    <DashboardShell
      businessName={business.name}
      logoUrl={business.logoUrl}
      memberships={memberships.map((m) => ({ businessId: m.businessId, name: m.business.name, role: m.role, active: m.businessId === businessId }))}
      items={items}
    >
      {!access.inGoodStanding && (
        <div className="bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/30 px-4 py-2 text-center text-sm text-red-700 dark:text-red-400">
          Your business's subscription is {access.subscriptionStatus === "EXPIRED" ? "expired" : "cancelled"} — contact your administrator to restore access.
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
