import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { expenseService } from "@/server/services/expense.service";

type Ctx = { params: Promise<{ id: string }> };

// Delete a single expense line (e.g. fixing a typo'd entry).
export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  await expenseService.remove(id, user.id);
  return ok({ id });
});
