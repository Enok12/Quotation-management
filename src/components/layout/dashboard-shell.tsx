"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { BusinessSwitcher, type Membership } from "./business-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils/cn";

// Fixed, always-visible sidebar at lg+; below that it becomes an off-canvas
// drawer toggled by a mobile top bar, closing itself whenever the route changes.
export function DashboardShell({
  items,
  businessName,
  logoUrl,
  memberships,
  children,
}: {
  items: NavItem[];
  businessName?: string;
  logoUrl?: string | null;
  memberships?: Membership[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas print:h-auto print:overflow-visible">
      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: fixed drawer on mobile, static column at lg+ */}
      <aside
        className={cn(
          "w-64 lg:w-56 flex-none bg-stone-900 flex flex-col print:hidden",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10 flex items-start justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={businessName} className="w-9 h-9 rounded object-contain bg-white/5 flex-none" />
            ) : null}
            <span className="min-w-0">
              <span className="block font-serif text-2xl text-white tracking-tight">MONTRA</span>
              <span className="block text-stone-500 text-[10px] tracking-widest uppercase mt-0.5 truncate">
                {businessName || "Clothing & Manufacturing"}
              </span>
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="text-stone-400 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-sidebar">
          <SidebarNav items={items} />
        </nav>

        {/* Switch business (only shown when a member of more than one) */}
        {memberships && memberships.length > 1 && (
          <div className="border-t border-white/10 pt-2">
            <BusinessSwitcher memberships={memberships} />
          </div>
        )}

        {/* Theme */}
        <div className="px-3 pb-1 border-t border-white/10 pt-3">
          <ThemeToggle />
        </div>

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
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 flex-none print:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="text-stone-600 dark:text-stone-300"
          >
            <Menu size={22} />
          </button>
          <span className="font-serif text-lg text-ink">MONTRA</span>
        </div>

        <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
      </div>
    </div>
  );
}
