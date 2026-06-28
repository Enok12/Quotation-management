"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

// Swaps the leading icon for a spinner while the link navigation is in flight.
function LeadingIcon({ icon, size }: { icon?: React.ReactNode; size: number }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 size={size} className="animate-spin" />;
  return <>{icon ?? null}</>;
}

/**
 * A Link styled as a button that shows a spinner while navigating to a slow
 * page (e.g. "New Receipt" → the builder). Keeps Link semantics/prefetch.
 */
export function LinkButton({
  href,
  className,
  icon,
  iconSize = 15,
  children,
  prefetch,
}: {
  href: string;
  className?: string;
  icon?: React.ReactNode;
  iconSize?: number;
  children: React.ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      <LeadingIcon icon={icon} size={iconSize} />
      {children}
    </Link>
  );
}
