import { NextRequest, NextResponse } from "next/server";
import { verifyReceiptId } from "@/lib/utils/receipt-pdf-token";
import { receiptRepository } from "@/server/repositories/receipt.repository";
import { renderReceiptPdf } from "@/server/pdf/render-receipt";
import { receiptFileName, draftReceiptFileName } from "@/lib/utils/receipt-filename";

// PUBLIC, unauthenticated on purpose: this is the link shared into a WhatsApp
// message, so the recipient is a customer with no login. Authorization is the
// HMAC signature over the receipt id (see receipt-pdf-token.ts) — without a
// valid `sig` this returns 404, and the signature can't be forged without the
// server's secret key. An attacker can't enumerate receipts by guessing ids.
//
// Every failure returns the same 404 so a valid-id/bad-sig is indistinguishable
// from a nonexistent id — no oracle for probing which ids exist.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (!verifyReceiptId(id, sig)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const receipt = await receiptRepository.findFullForSignedPdf(id);
  if (!receipt) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = await renderReceiptPdf(receipt);
  const filename = receipt.receiptNumber !== null
    ? receiptFileName(receipt.receiptNumber, receipt.custName, receipt.orderType)
    : draftReceiptFileName(receipt.id, receipt.custName);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // inline so tapping the WhatsApp link opens a preview rather than forcing
      // a download on the customer's phone.
      "Content-Disposition": `inline; filename="${filename}"`,
      // The document is immutable for a given id+sig; let the customer's
      // browser cache it briefly so a re-tap doesn't re-render server-side.
      "Cache-Control": "private, max-age=300",
    },
  });
}
