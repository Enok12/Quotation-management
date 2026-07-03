import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/utils/format";
import { TrackingInvalid } from "../_components/tracking-invalid";
import { StageTimeline } from "../_components/stage-timeline";

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
      orderStatus: true,
      orderType: true,
      orderHistory: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });

  // Only bulk orders have tracking tokens, but guard defensively anyway.
  if (!receipt || receipt.orderType !== "BULK") return <TrackingInvalid />;

  // Latest date each stage was reached (later entries overwrite earlier ones
  // in case the status was ever moved back and forward again).
  const stageDates: Partial<Record<string, Date>> = {};
  for (const h of receipt.orderHistory) stageDates[h.toStatus] = h.createdAt;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/montra-wordmark.png" alt="MONTRA" className="h-9 mx-auto mb-6" />
          <h1 className="font-serif text-2xl text-ink">Order Tracking</h1>
          <p className="text-stone-500 text-sm mt-1">
            Receipt #{receipt.receiptNumber} · {receipt.custName} · {fmtDate(receipt.date)}
          </p>
        </div>

        <div className="card card-body">
          <StageTimeline currentStatus={receipt.orderStatus} stageDates={stageDates} />
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          Questions about your order? Contact MONTRA directly.
        </p>
      </div>
    </main>
  );
}
