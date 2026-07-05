import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <DashboardShell
      items={[
        { href: "/dashboard", icon: "LayoutDashboard", label: "Dashboard", exact: true },
        { href: "/dashboard/customers", icon: "Users", label: "Customers" },
        { href: "/dashboard/receipts", icon: "FileText", label: "Receipts" },
        { href: "/dashboard/payments", icon: "Wallet", label: "Orders" },
        { href: "/dashboard/orders", icon: "Package", label: "Production" },
        { href: "/dashboard/expenses", icon: "Banknote", label: "Expenses" },
        { href: "/dashboard/income", icon: "TrendingUp", label: "Income" },
        { href: "/dashboard/audit", icon: "ClipboardList", label: "Audit Log" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
