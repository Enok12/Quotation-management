import { NextRequest, NextResponse } from "next/server";
import { handler } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { receiptService } from "@/server/services/receipt.service";
import { renderReceiptPdf } from "@/server/pdf/render-receipt";
import { receiptFileName } from "@/lib/utils/receipt-filename";

type Ctx = { params: Promise<{ id: string }> };

// Explicit generation only — never during typing (the UI uses a live HTML preview).
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const receipt = await receiptService.getFull(id);
  const bytes = await renderReceiptPdf(receipt);

  // Folder-sync fetches the PDF purely to write it to disk — skip the audit
  // entry in that case so reconciling many invoices doesn't flood the log.
  const silent = new URL(req.url).searchParams.get("silent") === "1";
  if (!silent) {
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "PDF_GENERATED", entityType: "Receipt", entityId: id },
    });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receiptFileName(receipt.receiptNumber, receipt.custName)}"`,
    },
  });
});
