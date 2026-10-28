import { whatsappLink } from "./utils/phone";

// Level-1 WhatsApp flow: the app never sends a message itself. It builds a
// wa.me link with the text prefilled and the seller taps send in their own
// WhatsApp. Links are assembled in the browser (window.location.origin) so
// they always point at the domain the seller is actually using — same reason
// send-whatsapp-button.tsx does it client-side.

const money = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

interface Base { businessName: string; customerName: string; phone: string; dispatchRef: string }

export function confirmationMessage(b: Base & { confirmUrl: string; codAmount: number }) {
  return whatsappLink(b.phone,
    `Hi ${b.customerName}, thank you for your order from ${b.businessName} (${b.dispatchRef}).\n\n` +
    `Please check your delivery details and confirm your order here:\n${b.confirmUrl}\n\n` +
    `Amount to pay on delivery: Rs. ${money(b.codAmount)}`);
}

export function dispatchedMessage(b: Base & { courierName: string | null; waybillNo: string | null; codAmount: number }) {
  const via = b.courierName ? ` via ${b.courierName}` : "";
  const waybill = b.waybillNo ? `\nTracking / waybill no: ${b.waybillNo}` : "";
  return whatsappLink(b.phone,
    `Hi ${b.customerName}, your order ${b.dispatchRef} from ${b.businessName} has been dispatched${via}.${waybill}\n` +
    `Please keep Rs. ${money(b.codAmount)} ready for the delivery person.`);
}

export function arrivingMessage(b: Base & { codAmount: number }) {
  return whatsappLink(b.phone,
    `Hi ${b.customerName}, your order ${b.dispatchRef} from ${b.businessName} is arriving today. ` +
    `Please keep Rs. ${money(b.codAmount)} ready. Thank you!`);
}

export function deliveredMessage(b: Base) {
  return whatsappLink(b.phone,
    `Hi ${b.customerName}, thank you for shopping with ${b.businessName}! Your order ${b.dispatchRef} has been delivered. ` +
    `If anything isn't right, just reply to this message.`);
}
