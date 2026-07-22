import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { staffInviteService } from "@/server/services/staff-invite.service";
import { fmtDateTime } from "@/lib/utils/format";
import { GenerateStaffInviteButton } from "@/components/team/generate-staff-invite-button";
import { RevokeInviteButton } from "@/components/team/revoke-invite-button";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { role, businessId, id: userId } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "TEAM")) return <SectionUnavailable section="Team" />;
  const isAdmin = role === "ADMIN";

  const members = await prisma.businessMember.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, role: true, createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const invites = isAdmin ? await staffInviteService.list(businessId) : [];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink">Team</h1>
          <p className="text-stone-500 text-sm mt-1">
            {members.length} member{members.length === 1 ? "" : "s"}
          </p>
        </div>
        {isAdmin && <GenerateStaffInviteButton />}
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-ink">Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Name</th>
                <th className="th text-left">Email</th>
                <th className="th text-left">Role</th>
                <th className="th text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-medium">
                    {m.user.name ?? "—"}
                    {m.user.id === userId && <span className="text-xs text-stone-400 ml-2">(you)</span>}
                  </td>
                  <td className="td text-stone-500 text-xs">{m.user.email}</td>
                  <td className="td">
                    <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{m.role}</span>
                  </td>
                  <td className="td text-stone-400 text-xs">{fmtDateTime(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-ink">Pending &amp; past invites</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th text-left">Role</th>
                  <th className="th text-left">Status</th>
                  <th className="th text-left">Created</th>
                  <th className="th text-left">Expires</th>
                  <th className="th w-16"></th>
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-stone-400 py-8">No invites yet.</td></tr>
                )}
                {invites.map((inv) => {
                  const expired = !!inv.expiresAt && inv.expiresAt < new Date();
                  const status = inv.usedAt
                    ? `Used by ${inv.usedBy?.name ?? inv.usedBy?.email ?? "someone"}`
                    : expired
                      ? "Expired"
                      : "Pending";
                  return (
                    <tr key={inv.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                      <td className="td text-xs font-semibold uppercase tracking-wide text-stone-500">{inv.role}</td>
                      <td className="td text-xs text-stone-600">{status}</td>
                      <td className="td text-stone-400 text-xs">{fmtDateTime(inv.createdAt)}</td>
                      <td className="td text-stone-400 text-xs">{inv.expiresAt ? fmtDateTime(inv.expiresAt) : "—"}</td>
                      <td className="td">
                        {!inv.usedAt && !expired && <RevokeInviteButton id={inv.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
