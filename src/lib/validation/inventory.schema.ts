import { z } from "zod";

export const inventoryProductCreateSchema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  categoryId: z.string().optional().nullable(),
  costPrice: z.number().nonnegative().default(0),
  sellingPrice: z.number().nonnegative().default(0),
  // Only meaningful at creation — becomes an initial "Opening stock" IN
  // movement, so quantityOnHand is never set outside a movement (see
  // inventory.service.ts).
  openingQuantity: z.number().int().nonnegative().default(0),
});
export const inventoryProductUpdateSchema = inventoryProductCreateSchema.omit({ openingQuantity: true }).partial();

export const stockMovementSchema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().int().positive(),
  reason: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});

export type InventoryProductCreateInput = z.infer<typeof inventoryProductCreateSchema>;
export type InventoryProductUpdateInput = z.infer<typeof inventoryProductUpdateSchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
