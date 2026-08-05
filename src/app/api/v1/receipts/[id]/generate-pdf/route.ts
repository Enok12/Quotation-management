import { NextRequest, NextResponse } from "next/server";
import { handler } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { receiptService } from "@/server/services/receipt.service";
import { renderReceiptPdf } from "@/server/pdf/render-receipt";
import { receiptFileName, draftReceiptFileName } from "@/lib/utils/receipt-filename";

type Ctx = { params: Promise<{ id: string }> };

// PDF rendering is CPU-bound; a large receipt (or a burst during folder sync)
// can run past the Hobby-tier default. Raise the ceiling so it can't 504.
// Only takes effect on Vercel Pro+; harmless (ignored) on Hobby.
export const maxDuration = 60;

async function renderPdf(id: string, businessId: string, actorId: string, audit: boolean) {
  const receipt = await receiptService.getFull(id, businessId);
  const bytes = await renderReceiptPdf(receipt);

  if (audit) {
    await prisma.auditLog.create({
      data: { businessId: receipt.businessId, actorId, action: "PDF_GENERATED", entityType: "Receipt", entityId: id },
    });
  }

  const filename = receipt.receiptNumber !== null
    ? receiptFileName(receipt.receiptNumber, receipt.custName, receipt.orderType)
    : draftReceiptFileName(receipt.id, receipt.custName);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: the browser opens the PDF in its own viewer, from which the
      // user can save or share. This is the ONE behavior that works reliably
      // on both desktop and mobile — a blob download with an <a download> is
      // silently ignored by iOS Safari, which is why the button "didn't work"
      // on phones. The filename is still offered for the viewer's Save action.
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

// GET: opened by the PDF button as a top-level navigation in a new tab (the
// browser sends the session cookie, so requireBusiness() still authenticates).
// Always audited — it's an explicit user action, not folder-sync traffic.
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireBusiness();
  const { id } = await params;
  return renderPdf(id, user.businessId, user.id, true);
});

// POST: used by folder sync (with ?silent=1 to skip the audit entry so
// reconciling many invoices doesn't flood the log). Works for an Unconfirmed
// receipt too — rendered as a clearly-marked draft (see receipt-template.ts).
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireBusiness();
  const { id } = await params;
  const silent = new URL(req.url).searchParams.get("silent") === "1";
  return renderPdf(id, user.businessId, user.id, !silent);
});
