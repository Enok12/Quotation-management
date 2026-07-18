import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { ForbiddenError } from "@/lib/api/errors";

// 404s (not 403s) for anyone without the flag — reveals nothing about this
// area existing at all. There is no UI/API path that grants isSuperAdmin;
// it's only ever set by hand in the database.
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 flex items-center gap-6">
          <Link href="/super-admin" className="font-serif text-xl text-ink">Super Admin</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/super-admin" className="text-stone-500 hover:text-amber-600 transition-colors">Businesses</Link>
            <Link href="/super-admin/plans" className="text-stone-500 hover:text-amber-600 transition-colors">Plans</Link>
          </nav>
          <Link href="/dashboard" className="ml-auto text-xs text-stone-400 hover:text-ink transition-colors">
            ← Back to dashboard
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
