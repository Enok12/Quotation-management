import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { expenseService } from "@/server/services/expense.service";

type Ctx = { params: Promise<{ id: string }> };

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

// Record an expense against a receipt.
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const input = expenseSchema.parse(await req.json());
  const expense = await expenseService.record(id, input, user.id);
  return ok({ id: expense.id }, 201);
});
