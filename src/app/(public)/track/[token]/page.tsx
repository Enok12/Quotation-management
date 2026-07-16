import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/utils/format";
import { TrackingInvalid } from "../_components/tracking-invalid";
import { ItemTrackingGrid } from "../_components/item-tracking-grid";

interface Props { params: Promise<{ token: string }> }
export const metadata = { title: "Order Tracking" };

export default async function TrackingPage({ params }: Props) {
  const { token } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { trackingToken: token },
    select: {
      receiptNumber: true,
      custName: true,
      date: true,
      orderType: true,
      business: { select: { name: true, logoUrl: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          description: true,
          orderStatus: true,
          history: {
            orderBy: { createdAt: "asc" },
            select: { toStatus: true, createdAt: true },
          },
        },
      },
    },
  });

  // Only bulk orders have tracking tokens, but guard defensively anyway.
  if (!receipt || receipt.orderType !== "BULK") return <TrackingInvalid />;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          {receipt.business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt.business.logoUrl} alt={receipt.business.name} className="h-12 mx-auto mb-6 object-contain" />
          ) : (
            <p className="font-serif text-xl text-ink mb-6">{receipt.business.name}</p>
          )}
          <h1 className="font-serif text-2xl text-ink">Order Tracking</h1>
          <p className="text-stone-500 text-sm mt-1">
            Receipt #{receipt.receiptNumber} · {receipt.custName} · {fmtDate(receipt.date)}
          </p>
        </div>

        <ItemTrackingGrid
          items={receipt.items.map((item) => {
            // Latest date each stage was reached (later entries overwrite
            // earlier ones in case a status was ever moved back and forward).
            const stageDates: Partial<Record<string, Date>> = {};
            for (const h of item.history) stageDates[h.toStatus] = h.createdAt;
            return { id: item.id, description: item.description, orderStatus: item.orderStatus, stageDates };
          })}
        />

        <p className="text-center text-xs text-stone-400 mt-6">
          Questions about your order? Contact {receipt.business.name} directly.
        </p>
      </div>
    </main>
  );
}
