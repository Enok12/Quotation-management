import { NextRequest, NextResponse } from "next/server";
import { handler } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { NotFoundError } from "@/lib/api/errors";
import { codService } from "@/server/services/cod.service";
import { generateDispatchSheet } from "@/server/pdf/dispatch-sheet";

type Ctx = { params: Promise<{ id: string }> };

// PDF rendering is CPU-bound — same ceiling the receipt PDF route raises.
export const maxDuration = 60;

// Opened in a new tab by the "Dispatch sheet" button (a top-level navigation,
// so the session cookie authenticates it). Tenant-scoped via getForSheet.
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");
  const { id } = await params;

  const d = await codService.getForSheet(id, businessId);
  if (!d) throw new NotFoundError("COD order");

  const bytes = await generateDispatchSheet({
    businessName: d.business.name,
    dispatchRef: d.dispatchRef,
    courierName: d.courierName,
    waybillNo: d.waybillNo,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    customerPhone2: d.customerPhone2,
    address: d.deliveryAddress,
    city: d.city,
    items: d.sale.items.map((i) => ({
      sku: i.product.sku, name: i.product.name, quantity: i.quantity,
      unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal),
    })),
    itemsTotal: Number(d.sale.totalAmount),
    deliveryFee: Number(d.deliveryFee),
    feePaidBy: d.feePaidBy,
    codAmount: Number(d.codAmount),
    date: new Intl.DateTimeFormat("en-GB").format(d.createdAt),
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // dispatchRef is always ASCII ("COD-0042"), so no header-encoding issue.
      "Content-Disposition": `inline; filename="dispatch-${d.dispatchRef}.pdf"`,
    },
  });
});
