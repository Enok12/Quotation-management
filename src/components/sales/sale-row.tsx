"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { fmtMoney, fmtDateTime } from "@/lib/utils/format";
import { ReturnItemButton } from "./return-item-button";

interface SaleItem {
  id: string; sku: string; productName: string; quantity: number; unitPrice: number; lineTotal: number; profit: number;
  returnedQuantity: number; returnable: number;
}
interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: string | null;
  note: string | null;
  soldBy: string;
  createdAt: string;
  /** Set for Cash-on-Delivery sales (only delivered ones reach this list). */
  cod: { dispatchRef: string; status: string; deliveryCost: number } | null;
}

const PAYMENT_LABEL: Record<string, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Bank Transfer", OTHER: "Other" };

// One row per sale transaction, collapsed by default. Items are already
// loaded server-side (a sale rarely has more than a handful of lines), so
// expanding just toggles visibility rather than fetching anything.
export function SaleRow({ sale }: { sale: Sale }) {
  const [expanded, setExpanded] = useState(false);
  const unitsSold = sale.items.reduce((sum, i) => sum + i.quantity, 0);
  const profit = sale.items.reduce((sum, i) => sum + i.profit, 0) - (sale.cod?.deliveryCost ?? 0);
  const profitClass = profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const summary = sale.items.length === 1
    ? sale.items[0].productName
    : `${sale.items.length} products`;

  return (
    <>
      <tr className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <td className="td w-8 text-stone-300">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="td text-xs text-stone-500 whitespace-nowrap">{fmtDateTime(sale.createdAt)}</td>
        <td className="td font-medium">{summary}</td>
        <td className="td text-right font-mono text-sm">{unitsSold}</td>
        <td className="td text-right font-mono text-sm">{fmtMoney(sale.totalAmount)}</td>
        <td className={`td text-right font-mono text-sm ${profitClass}`}>{fmtMoney(profit)}</td>
        <td className="td text-xs text-stone-500">
          {sale.cod ? `COD · ${sale.cod.dispatchRef}` : sale.paymentMethod ? PAYMENT_LABEL[sale.paymentMethod] : "—"}
        </td>
        <td className="td text-xs text-stone-500">{sale.soldBy}</td>
      </tr>
      {expanded && (
        <tr>
          <td></td>
          <td colSpan={7} className="td bg-stone-25 dark:bg-white/[0.02] py-2">
            <table className="w-full">
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1 pr-3"><code className="font-mono text-xs">{item.sku}</code></td>
                    <td className="py-1 pr-3 text-sm">{item.productName}</td>
                    <td className="py-1 pr-3 text-right font-mono text-xs">{item.quantity} ×</td>
                    <td className="py-1 pr-3 text-right font-mono text-xs">{fmtMoney(item.unitPrice)}</td>
                    <td className="py-1 pr-3 text-right font-mono text-xs">{fmtMoney(item.lineTotal)}</td>
                    <td className="py-1 pr-3 text-xs text-stone-400">
                      {item.returnedQuantity > 0 && <span>{item.returnedQuantity} returned</span>}
                    </td>
                    <td className="py-1">
                      <ReturnItemButton
                        saleItemId={item.id} sku={item.sku} productName={item.productName}
                        unitPrice={item.unitPrice} returnable={item.returnable}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sale.note && <p className="text-xs text-stone-400 mt-1">Note: {sale.note}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
