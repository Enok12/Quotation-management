import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";

// Covers every /dashboard/receipts/** route (list, detail, edit, new,
// new/bulk, new/bulk-sample) in one place.
export default async function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "RECEIPTS")) return <SectionUnavailable section="Receipts" />;
  return <>{children}</>;
}
