import { NextRequest, NextResponse } from "next/server";
import { handler } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { receiptService } from "@/server/services/receipt.service";
import { renderReceiptPdf } from "@/server/pdf/render-receipt";

type Ctx = { params: Promise<{ id: string }> };

// Explicit generation only — never during typing (the UI uses a live HTML preview).
export const POST = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const receipt = await receiptService.getFull(id);
  const bytes = await renderReceiptPdf(receipt);

  await prisma.auditLog.create({
    data: { actorId: user.id, action: "PDF_GENERATED", entityType: "Receipt", entityId: id },
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${receipt.receiptNumber}.pdf"`,
    },
  });
});
