import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BusinessNameForm } from "@/components/settings/business-name-form";
import { BusinessLogoUploader } from "@/components/settings/business-logo-uploader";
import { BusinessApiKeyForm } from "@/components/settings/business-api-key-form";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";

export const metadata = { title: "Settings" };

// Business identity is sensitive shared state (it appears on every receipt
// PDF and public customer-facing page) — admin-only, unlike Team which any
// member can at least view.
export default async function SettingsPage() {
  const { businessId, role } = await requireAdmin();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "SETTINGS")) return <SectionUnavailable section="Settings" />;
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { name: true, logoUrl: true, geminiApiKeyEncrypted: true, notificationEmail: true },
  });

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Settings</h1>
        <p className="text-stone-500 text-sm mt-1">
          Your business name and logo appear on receipt PDFs and customer-facing pages.
        </p>
      </div>

      <div className="card card-body mb-6">
        <h2 className="heading-2 mb-4">Business details</h2>
        <BusinessNameForm initialName={business.name} initialNotificationEmail={business.notificationEmail ?? ""} />
      </div>

      <div className="card card-body mb-6">
        <h2 className="heading-2 mb-4">Logo</h2>
        <BusinessLogoUploader initialLogoUrl={business.logoUrl} />
      </div>

      <div className="card card-body">
        <h2 className="heading-2 mb-1">AI receipt import</h2>
        <p className="text-sm text-stone-500 mb-4">
          Receipt-photo import (Bulk Upload) uses a shared Gemini API key by default. Add your own
          if you're importing a lot of receipts and want your own usage quota.
        </p>
        <BusinessApiKeyForm hasCustomApiKey={!!business.geminiApiKeyEncrypted} />
      </div>
    </div>
  );
}
