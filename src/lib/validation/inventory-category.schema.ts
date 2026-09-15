import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
});
export const categoryUpdateSchema = categoryCreateSchema;

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
