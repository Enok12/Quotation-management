import { AlertCircle, CheckCircle } from "lucide-react";
import { codService } from "@/server/services/cod.service";
import { fmtMoney } from "@/lib/utils/format";
import { CodConfirmClient } from "../_components/cod-confirm-client";

interface Props { params: Promise<{ token: string }> }

// Always read fresh: the page's state (open / confirmed / cancelled) changes.
export const dynamic = "force-dynamic";

function Notice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {icon}
        <h2 className="font-serif text-2xl text-ink mb-2">{title}</h2>
        <p className="text-stone-500 text-sm">{body}</p>
      </div>
    </main>
  );
}

export default async function CodConfirmPage({ params }: Props) {
  const { token } = await params;
  const order = await codService.getForConfirmation(token);

  // Unknown token: say nothing about why, or which business it might belong to.
  if (!order) {
    return (
      <Notice
        icon={<AlertCircle size={44} className="text-stone-400 mx-auto mb-4" />}
        title="Link not valid"
        body="This link is invalid. Please contact the business you ordered from."
      />
    );
  }

  const biz = order.business.name;
  if (order.expired) {
    return (
      <Notice
        icon={<AlertCircle size={44} className="text-amber-500 mx-auto mb-4" />}
        title="This link has expired"
        body={`Please contact ${biz} and ask them to send you a new confirmation link.`}
      />
    );
  }
  if (!order.open) {
    const confirmed = ["PENDING_DISPATCH", "OUT_FOR_DELIVERY", "DELIVERED", "REMITTED"].includes(order.status);
    return confirmed ? (
      <Notice
        icon={<CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />}
        title="Order confirmed"
        body={`Thank you! ${biz} has your order ${order.dispatchRef} and will arrange delivery. Please keep Rs. ${fmtMoney(order.codAmount)} ready for the delivery person.`}
      />
    ) : (
      <Notice
        icon={<AlertCircle size={44} className="text-stone-400 mx-auto mb-4" />}
        title="Order closed"
        body={`Order ${order.dispatchRef} is no longer active. Contact ${biz} if you think this is a mistake.`}
      />
    );
  }

  return (
    <CodConfirmClient
      token={token}
      businessName={biz}
      logoUrl={order.business.logoUrl}
      dispatchRef={order.dispatchRef}
      items={order.sale.items.map((i) => ({
        name: i.product.name, quantity: i.quantity, lineTotal: Number(i.lineTotal),
      }))}
      deliveryFee={order.feePaidBy === "CUSTOMER" ? Number(order.deliveryFee) : 0}
      codAmount={Number(order.codAmount)}
      customer={{
        name: order.customerName, phone: order.customerPhone, phone2: order.customerPhone2 ?? "",
        address: order.deliveryAddress, city: order.city ?? "",
      }}
    />
  );
}
