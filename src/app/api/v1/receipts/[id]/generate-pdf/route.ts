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

// Explicit generation only — never during typing (the UI uses a live HTML preview).
// Works for an Unconfirmed receipt too — renders as a clearly-marked draft
// (see receipt-template.ts) so folder sync has something to place for it.
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireBusiness();
  const { id } = await params;
  const receipt = await receiptService.getFull(id, user.businessId);
  const bytes = await renderReceiptPdf(receipt);

  // Folder-sync fetches the PDF purely to write it to disk — skip the audit
  // entry in that case so reconciling many invoices doesn't flood the log.
  const silent = new URL(req.url).searchParams.get("silent") === "1";
  if (!silent) {
    await prisma.auditLog.create({
      data: { businessId: receipt.businessId, actorId: user.id, action: "PDF_GENERATED", entityType: "Receipt", entityId: id },
    });
  }

  const filename = receipt.receiptNumber !== null
    ? receiptFileName(receipt.receiptNumber, receipt.custName, receipt.orderType)
    : draftReceiptFileName(receipt.id, receipt.custName);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
});
