import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";

// Covers every /dashboard/customers/** route in one place.
export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "CUSTOMERS")) return <SectionUnavailable section="Customers" />;
  return <>{children}</>;
}
