"use client";

import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { receiptNumberLabelOr, type ReceiptOrderType } from "@/lib/utils/receipt-number";

interface Props {
  receiptId: string;
  receiptNumber: number | null;
  orderType: ReceiptOrderType;
  custName: string;
  /** Customer's phone as stored — may be local (0xx…) or international. */
  custPhone: string | null;
  businessName: string;
  /** Public, HMAC-signed URL that renders this receipt's PDF (built server-side). */
  pdfUrl: string;
}

// Turn whatever is stored into the bare international digits wa.me expects
// (no "+", no leading 0). Assumes Sri Lanka (94) for local 0-prefixed numbers,
// which is the business's market; an already-international number is left as-is.
function toWaNumber(phone: string | null): string {
  if (!phone) return "";
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "94" + d.slice(1);
  return d;
}

// Sends the receipt to the customer over WhatsApp. Best behavior per device:
//  • Phone with file-sharing: shares the ACTUAL PDF via the native share sheet.
//  • Otherwise (desktop, or no file-share support): opens WhatsApp to the
//    customer's number with a pre-typed message containing the PDF link.
// WhatsApp itself allows neither attaching a file via a link nor targeting a
// number with a file, so this is as close as it gets without the Business API.
export function SendWhatsappButton({
  receiptId, receiptNumber, orderType, custName, custPhone, businessName, pdfUrl,
}: Props) {
  const [busy, setBusy] = useState(false);

  const label = receiptNumberLabelOr(receiptNumber, orderType, "your order");
  const message = `Hi ${custName}, here's your receipt ${label} from ${businessName}:\n${pdfUrl}`;

  const openWaLink = () => {
    const num = toWaNumber(custPhone);
    // With a number: opens straight to that chat. Without one: opens WhatsApp
    // with the text and lets the sender pick the contact.
    const base = num ? `https://wa.me/${num}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  const onClick = async () => {
    setBusy(true);
    try {
      // Try to share the real PDF file first.
      const res = await fetch(pdfUrl);
      if (res.ok && typeof navigator !== "undefined" && navigator.canShare) {
        const blob = await res.blob();
        const file = new File([blob], `receipt-${label.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], text: message, title: `Receipt ${label}` });
            return; // shared (or the user cancelled) — don't also open a link
          } catch (err) {
            // The user dismissing the share sheet is not a failure — stop here.
            if (err instanceof DOMException && err.name === "AbortError") return;
            // Anything else: fall through to the link.
          }
        }
      }
      openWaLink();
    } catch {
      // Fetch failed (offline, etc.) — the link still works, it just carries
      // the PDF URL for the customer to open themselves.
      openWaLink();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="btn-outline"
      title="Send this receipt to the customer on WhatsApp"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
      WhatsApp
    </button>
  );
}
