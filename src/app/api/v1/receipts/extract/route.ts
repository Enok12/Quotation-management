import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth";
import { receiptExtractService } from "@/server/services/receipt-extract.service";
import { MAX_UPLOAD_BYTES, isAcceptedReceiptFile } from "@/lib/receipt-upload-limits";

// Reads an uploaded photo (or PDF) of a MONTRA receipt and returns best-effort
// extracted fields to pre-fill the receipt builder. Never persists anything.
export const POST = handler(async (req: NextRequest) => {
  await requireUser();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("No file was uploaded.", 400);
  if (!isAcceptedReceiptFile(file)) throw new AppError("Please upload an image (JPG or PNG) or a PDF.", 400);
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("File is too large (max 12MB).", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const data = await receiptExtractService.extract(base64, file.type);
  return ok(data);
});
