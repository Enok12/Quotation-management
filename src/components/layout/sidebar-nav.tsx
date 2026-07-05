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
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  icon: NavIcon;
  label: string;
  exact?: boolean;
}

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn("nav-item", active && "nav-item-active")}
          >
            <Icon size={16} strokeWidth={1.8} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
