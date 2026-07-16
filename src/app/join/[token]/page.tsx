import { ShieldOff } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { staffInviteService } from "@/server/services/staff-invite.service";
import { JoinBusinessButton } from "@/components/onboarding/join-business-button";

interface Props { params: Promise<{ token: string }> }
export const metadata = { title: "Join a business" };

export default async function JoinInvitePage({ params }: Props) {
  // Requires sign-in first (this route isn't in the middleware's public
  // list) — a signed-out visitor is bounced to /sign-in and lands back here
  // afterward via Clerk's redirect_url, which also covers brand-new staff
  // signing up straight from an invite link.
  await requireUser();
  const { token } = await params;

  const invite = await staffInviteService.preview(token);

  if (!invite) {
    return (
      <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <ShieldOff size={44} className="text-stone-400 mx-auto mb-4" />
          <h1 className="font-serif text-2xl text-ink mb-2">Invite link invalid</h1>
          <p className="text-stone-500 text-sm">
            This invite has expired or has already been used. Ask your administrator to send a new one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-ink tracking-tight">MONTRA</h1>
          <p className="text-stone-500 text-sm mt-1 tracking-widest uppercase">Clothing & Manufacturing</p>
        </div>
        <div className="card card-body text-center">
          <h2 className="font-serif text-2xl text-ink mb-1">Join {invite.business.name}</h2>
          <p className="text-stone-500 text-sm mb-6">
            You've been invited as <span className="font-medium text-ink">{invite.role === "ADMIN" ? "an Administrator" : "Staff"}</span>.
          </p>
          <JoinBusinessButton token={token} />
        </div>
      </div>
    </main>
  );
}
