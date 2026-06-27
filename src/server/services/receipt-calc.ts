// Pure totals math. Single source of truth used by both the service layer
// (persisted values) and the PDF renderer — they can never drift.
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CalcInput {
  items: { quantity: number; unitPrice: number }[];
  adjustments: { amount: number }[];
  advanceAmount: number;
  amountPaid: number;
}
export interface CalcResult {
  lineTotals: number[];
  subtotal: number;
  adjustmentsTotal: number;
  totalDue: number;
  balance: number;
}

export function calcReceiptTotals(input: CalcInput): CalcResult {
  const lineTotals = input.items.map((i) => round2(i.quantity * i.unitPrice));
  const subtotal = round2(lineTotals.reduce((s, v) => s + v, 0));
  const adjustmentsTotal = round2(input.adjustments.reduce((s, a) => s + a.amount, 0));
  const totalDue = round2(subtotal + adjustmentsTotal);
  const balance = round2(totalDue - input.advanceAmount - input.amountPaid);
  return { lineTotals, subtotal, adjustmentsTotal, totalDue, balance };
}
