import { NextRequest } from "next/server";
import { handler, ok, fail } from "@/lib/api/response";
import { prisma } from "@/lib/db";

// Public lookup by invoice number + last 4 digits of phone — no auth.
// Both must match a BULK order; sample orders, unknown numbers, and phone
// mismatches all get the exact same generic message so a guesser can't tell
// which part was wrong (or whether the order even exists).
//
// Note: this endpoint has no built-in rate limiting. Brute-forcing a 4-digit
// phone suffix against a known invoice number is only ~10,000 attempts, so if
// abuse becomes a concern, add rate limiting at the infra layer (Vercel/Cloudflare).
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const raw = sp.get("number")?.trim() ?? "";
  const phoneLast4 = sp.get("phone")?.trim() ?? "";

  const receiptNumber = Number(raw);
  if (!raw || !Number.isInteger(receiptNumber) || receiptNumber <= 0) {
    return fail("Enter a valid invoice number.", 400);
  }
  if (!/^\d{4}$/.test(phoneLast4)) {
    return fail("Enter the last 4 digits of the phone number on the order.", 400);
  }

  const receipt = await prisma.receipt.findUnique({
    where: { receiptNumber },
    select: {
      receiptNumber: true,
      custName: true,
      custPhone: true,
      date: true,
      orderStatus: true,
      orderType: true,
      orderHistory: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });

  const phoneDigits = (receipt?.custPhone ?? "").replace(/\D/g, "");
  const phoneMatches = phoneDigits.length >= 4 && phoneDigits.slice(-4) === phoneLast4;

  if (!receipt || receipt.orderType !== "BULK" || !phoneMatches) {
    return fail("No order found for that invoice number and phone number.", 404);
  }

  const stageDates: Record<string, Date> = {};
  for (const h of receipt.orderHistory) stageDates[h.toStatus] = h.createdAt;

  return ok({
    receiptNumber: receipt.receiptNumber,
    custName: receipt.custName,
    date: receipt.date,
    orderStatus: receipt.orderStatus,
    stageDates,
  });
});
