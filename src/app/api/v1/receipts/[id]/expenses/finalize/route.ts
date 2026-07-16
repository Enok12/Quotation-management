import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { expenseRecordService } from "@/server/services/expense.service";


type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ finalized: z.boolean() });

// Finalize (or unlock) a receipt's expense record. Admin-only — finalizing is
// what makes the record count toward the Income/P&L page.
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireAdmin();
  const { id } = await params;
  const { finalized } = bodySchema.parse(await req.json());
  const record = await expenseRecordService.setFinalized(id, finalized, user.id, user.businessId);
  return ok({ id: record.id, finalized: record.finalized });
});
