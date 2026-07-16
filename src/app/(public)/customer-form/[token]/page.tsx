import { prisma } from "@/lib/db";
import { CustomerFormClient } from "../_components/customer-form-client";
import { InviteInvalid } from "../_components/invite-invalid";

interface Props { params: Promise<{ token: string }> }

export const metadata = { title: "Customer Registration" };

export default async function CustomerInviteFormPage({ params }: Props) {
  const { token } = await params;

  const invite = await prisma.customerInvite.findUnique({
    where: { token },
    include: { business: { select: { name: true, logoUrl: true } } },
  });
  const valid =
    !!invite &&
    !invite.usedAt &&
    (!invite.expiresAt || invite.expiresAt > new Date());

  if (!valid) return <InviteInvalid used={!!invite?.usedAt} businessName={invite?.business.name} />;

  return <CustomerFormClient token={token} businessName={invite.business.name} logoUrl={invite.business.logoUrl} />;
}
