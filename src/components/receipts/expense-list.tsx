"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  createdAt: string | Date;
}

// Lists expenses recorded against a receipt, with a delete action per row.
export function ExpenseList({ expenses }: { expenses: ExpenseRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const del = async (id: string) => {
    if (!window.confirm("Delete this expense entry?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/expenses/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to delete expense");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete expense");
    } finally {
      setDeletingId(null);
    }
  };

  if (expenses.length === 0) {
    return <p className="text-sm text-stone-400">No expenses recorded yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {expenses.map((exp) => (
        <li key={exp.id} className="flex items-start justify-between gap-2 text-sm border-t border-stone-50 dark:border-stone-700 pt-2">
          <div className="min-w-0">
            <p className="font-mono text-red-600 dark:text-red-400">{fmtMoney(exp.amount)}</p>
            <p className="text-stone-500 text-xs truncate">{exp.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <span className="text-xs text-stone-400 whitespace-nowrap">{fmtDate(exp.createdAt)}</span>
            <button
              onClick={() => del(exp.id)}
              disabled={deletingId === exp.id}
              title="Delete expense"
              aria-label="Delete expense"
              className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 transition-colors"
            >
              {deletingId === exp.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
