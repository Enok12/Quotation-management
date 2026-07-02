import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar */}
      <aside className="w-56 flex-none bg-stone-900 flex flex-col">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <Link href="/dashboard" className="block">
            <span className="font-serif text-2xl text-white tracking-tight">MONTRA</span>
            <span className="block text-stone-500 text-[10px] tracking-widest uppercase mt-0.5">
              Clothing & Manufacturing
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <SidebarNav
            items={[
              { href: "/dashboard", icon: "LayoutDashboard", label: "Dashboard", exact: true },
              { href: "/dashboard/customers", icon: "Users", label: "Customers" },
              { href: "/dashboard/receipts", icon: "FileText", label: "Receipts" },
              { href: "/dashboard/payments", icon: "Wallet", label: "Orders" },
              { href: "/dashboard/orders", icon: "Package", label: "Production" },
              { href: "/dashboard/audit", icon: "ClipboardList", label: "Audit Log" },
            ]}
          />
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10 flex items-center gap-3">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-7 h-7",
              },
            }}
          />
          <span className="text-stone-400 text-xs">Account</span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
