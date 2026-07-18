import { z } from "zod";

export const customerCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  address: z.string().max(400).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  otherPhone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(160).optional().nullable().or(z.literal("")),
  nic: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export const customerUpdateSchema = customerCreateSchema.partial();

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.enum(["name", "createdAt", "phone"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
