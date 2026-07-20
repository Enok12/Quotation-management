import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { receiptExtractService } from "@/server/services/receipt-extract.service";
import { MAX_UPLOAD_BYTES, isAcceptedReceiptFile } from "@/lib/receipt-upload-limits";

// This request stays open for the whole Gemini call (a few seconds, sometimes
// longer for a large multi-page PDF). Raise the ceiling above the Hobby-tier
// default so a slow model response can't 504 mid-upload. Only takes effect on
// Vercel Pro+; harmless (ignored) on Hobby.
export const maxDuration = 60;

// Reads an uploaded photo (or PDF) of a receipt and returns best-effort
// extracted fields to pre-fill the receipt builder. Never persists anything.
//
// There's no shared fallback key — each business must set its own Gemini API
// key in Settings before this feature works. Checked first, before even
// reading the uploaded file, so a business without one gets a clear answer
// immediately rather than paying the upload cost for nothing.
export const POST = handler(async (req: NextRequest) => {
  const { businessId } = await requireBusiness();

  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { geminiApiKeyEncrypted: true } });
  if (!business?.geminiApiKeyEncrypted) {
    throw new AppError(
      "Receipt photo import isn't set up for your business yet. Add a Gemini API key in Settings → AI receipt import to use this feature.",
      400,
    );
  }
  const apiKey = decryptSecret(business.geminiApiKeyEncrypted);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("No file was uploaded.", 400);
  if (!isAcceptedReceiptFile(file)) throw new AppError("Please upload an image (JPG or PNG) or a PDF.", 400);
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("File is too large (max 12MB).", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const data = await receiptExtractService.extract(base64, file.type, apiKey);
  return ok(data);
});
