"use client";

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { receiptNumberLabelOr, type ReceiptOrderType } from "@/lib/utils/receipt-number";

interface Props {
  receiptId: string;
  receiptNumber: number | null;
  orderType: ReceiptOrderType;
  custName: string;
  /** Customer's phone as stored — may be local (0xx…) or international. */
  custPhone: string | null;
  businessName: string;
  /** HMAC signature over the receipt id (built server-side — needs the secret
   * key). The absolute URL is assembled client-side from window.location.origin
   * so it always uses the domain the admin is actually on (production), exactly
   * like the registration and tracking links — never a server-side env var that
   * can resolve to a protected preview URL. */
  pdfSig: string;
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

// Shares the receipt to the customer. Mobile-only (hidden on desktop via
// md:hidden below), because the whole point is the phone's native share sheet:
// tap Share → the OS sheet opens → pick WhatsApp (or anything) → the ACTUAL
// PDF file is attached. If file-sharing isn't available, it falls back to
// opening WhatsApp to the customer's number with a message + PDF link.
export function SendWhatsappButton({
  receiptId, receiptNumber, orderType, custName, custPhone, businessName, pdfSig,
}: Props) {
  const [busy, setBusy] = useState(false);

  const label = receiptNumberLabelOr(receiptNumber, orderType, "your order");

  // Built here, in the browser, from the current origin — so the customer link
  // always points at the public domain the admin is actually using.
  const buildPdfUrl = () =>
    `${window.location.origin}/api/public/receipt-pdf?id=${receiptId}&sig=${encodeURIComponent(pdfSig)}`;
  const buildMessage = (pdfUrl: string) =>
    `Hi ${custName}, here's your receipt ${label} from ${businessName}:\n${pdfUrl}`;

  const openWaLink = (message: string) => {
    const num = toWaNumber(custPhone);
    // With a number: opens straight to that chat. Without one: opens WhatsApp
    // with the text and lets the sender pick the contact.
    const base = num ? `https://wa.me/${num}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  const onClick = async () => {
    setBusy(true);
    const pdfUrl = buildPdfUrl();
    const message = buildMessage(pdfUrl);
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
      openWaLink(message);
    } catch {
      // Fetch failed (offline, etc.) — the link still works, it just carries
      // the PDF URL for the customer to open themselves.
      openWaLink(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      // md:hidden → shown on phones/small tablets, hidden on desktop, since it
      // relies on the mobile native share sheet.
      className="btn-outline md:hidden"
      title="Share this receipt (e.g. to the customer on WhatsApp)"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
      Share
    </button>
  );
}
