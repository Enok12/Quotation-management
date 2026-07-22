import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBusinessAccess, hasSection } from "@/lib/section-access";

// How many orders the once-a-day reminder popup lists before deferring to
// its "View all" link.
const LIMIT = 8;

// Ongoing orders for the once-a-day reminder popup — confirmed, finalized
// orders that haven't reached COMPLETED yet.
//
// Only fetched when the client has actually decided to show the popup (it
// checks its own "already seen today" flag first), so this costs nothing on
// the vast majority of dashboard page loads.
//
// Returns an empty list rather than a 403 when the business's plan doesn't
// include Production: a reminder is passive, ambient UI, so a business
// without that section should simply never see the popup — not have a failed
// request logged on every first visit of the day.
export const GET = handler(async () => {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "PRODUCTION")) return ok({ orders: [], total: 0 });

  const where = {
    businessId,
    status: "FINALIZED" as const,
    // Unconfirmed orders (no advance paid yet) aren't in production at all,
    // so they're not "ongoing" work to be reminded about — same rule the
    // Production page itself uses.
    receiptNumber: { not: null },
    orderStatus: { not: "COMPLETED" as const },
  };

  const [total, orders] = await Promise.all([
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      // Oldest first — the whole point of a reminder is to surface what's
      // been sitting longest, not what was just created.
      orderBy: { date: "asc" },
      take: LIMIT,
      select: {
        id: true, receiptNumber: true, custName: true, date: true,
        balance: true, orderStatus: true, orderType: true,
      },
    }),
  ]);

  return ok({
    total,
    orders: orders.map((o) => ({
      id: o.id,
      receiptNumber: o.receiptNumber,
      custName: o.custName,
      date: o.date.toISOString(),
      balance: Number(o.balance),
      orderStatus: o.orderStatus,
      orderType: o.orderType,
    })),
  });
});
