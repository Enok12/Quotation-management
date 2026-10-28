"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  ClipboardList,
  Wallet,
  Banknote,
  TrendingUp,
  UserCog,
  Settings,
  Shirt,
  Sparkles,
  Boxes,
  ShoppingCart,
  Undo2,
  Tags,
  ArrowLeftRight,
  Truck,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  ClipboardList,
  Wallet,
  Banknote,
  TrendingUp,
  UserCog,
  Settings,
  Shirt,
  Sparkles,
  Boxes,
  ShoppingCart,
  Undo2,
  Tags,
  ArrowLeftRight,
  Truck,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  icon: NavIcon;
  label: string;
  exact?: boolean;
  /** Small uppercase header rendered above this item — only when it differs
   * from the previous item's group, so consecutive items under the same
   * group share one header (e.g. "Sales & POS" / "Inventory" under Retail). */
  group?: string;
}

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item, i) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        const showGroupHeader = item.group && item.group !== items[i - 1]?.group;
        return (
          <div key={item.href}>
            {showGroupHeader && (
              <div className={cn("px-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500", i === 0 ? "pt-0 pb-1.5" : "pt-4 pb-1.5")}>
                {item.group}
              </div>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn("nav-item", active && "nav-item-active")}
            >
              <Icon size={16} strokeWidth={1.8} />
              {item.label}
            </Link>
          </div>
        );
      })}
    </>
  );
}
