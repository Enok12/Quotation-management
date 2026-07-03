"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Customer { id: string; name: string; phone?: string | null; email?: string | null }

export function CustomerPickerShell({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">New Receipt</h1>
        <p className="text-stone-500 text-sm mt-1">Select a customer to continue</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="field-input pl-9 max-w-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-6 py-8 text-stone-400 text-sm text-center">No customers found.</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/dashboard/receipts/new?customerId=${c.id}`)}
              className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-stone-25 dark:hover:bg-white/5 transition-colors text-left"
            >
              <div>
                <p className="font-medium text-sm text-ink">{c.name}</p>
                <p className="text-xs text-stone-400 mt-0.5">{c.phone} {c.email ? `· ${c.email}` : ""}</p>
              </div>
              <ArrowRight size={14} className="text-stone-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
