"use client";

import { useState } from "react";
import { Banknote, X } from "lucide-react";
import { ExpenseEditorCard } from "./expense-editor-card";
import type { ExpenseRecordValues } from "./use-expense-editor";

interface Props {
  receiptId: string;
  receiptNumber: number;
  billAmount: number;
  initial: ExpenseRecordValues | null;
  isAdmin: boolean;
}

// Compact icon trigger (used in dense table rows, e.g. the Orders page) that
// opens the same expense editor shown on the receipt detail page, in a modal.
export function ExpenseRecordButton({ receiptId, receiptNumber, billAmount, initial, isAdmin }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit expenses"
        aria-label="Edit expenses"
        className="text-stone-300 hover:text-amber-500 dark:text-stone-600 dark:hover:text-amber-400 transition-colors p-1"
      >
        <Banknote size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-sm p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Expenses — Receipt #{receiptNumber}</h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <ExpenseEditorCard receiptId={receiptId} billAmount={billAmount} initial={initial} isAdmin={isAdmin} />
          </div>
        </div>
      )}
    </>
  );
}
