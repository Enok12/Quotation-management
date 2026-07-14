import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { expenseRecordService } from "@/server/services/expense.service";

type Ctx = { params: Promise<{ id: string }> };

const expenseRecordSchema = z.object({
  fabricExpense: z.coerce.number().nonnegative(),
  patternMakingExpense: z.coerce.number().nonnegative(),
  cuttingExpense: z.coerce.number().nonnegative(),
  productionExpense: z.coerce.number().nonnegative(),
  accessoryExpense: z.coerce.number().nonnegative(),
  otherExpense: z.coerce.number().nonnegative(),
  profit: z.coerce.number(),
});

// Create or update the receipt's expense record (six cost categories + profit).
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const input = expenseRecordSchema.parse(await req.json());
  const record = await expenseRecordService.upsert(id, input, user.id);
  return ok({ id: record.id });
});
