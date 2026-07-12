"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Upload, Loader2, X } from "lucide-react";
import { AddCustomerForm, type CustomerFormValues } from "@/components/customers/add-customer-form";
import { stashReceiptDraft } from "@/lib/receipt-draft";
import type { ReceiptExtractResult } from "@/lib/validation/receipt-extract.schema";

interface Customer { id: string; name: string; phone?: string | null; email?: string | null }

const digitsOnly = (s?: string | null) => (s ?? "").replace(/\D/g, "");

// Prefer a confident phone match (last 9 digits, ignoring country-code/
// formatting differences); fall back to an exact case-insensitive name match
// only when it's unambiguous.
function findMatch(customers: Customer[], extracted: { phone: string | null; customerName: string | null }) {
  const phone = digitsOnly(extracted.phone).slice(-9);
  if (phone) {
    const byPhone = customers.filter((c) => digitsOnly(c.phone).slice(-9) === phone);
    if (byPhone.length === 1) return byPhone[0];
  }
  const name = extracted.customerName?.trim().toLowerCase();
  if (name) {
    const byName = customers.filter((c) => c.name.trim().toLowerCase() === name);
    if (byName.length === 1) return byName[0];
  }
  return null;
}

type Stage =
  | { kind: "browse" }
  | { kind: "extracting" }
  | { kind: "needsCustomer"; extracted: ReceiptExtractResult }
  | { kind: "error"; message: string };

export function CustomerPickerShell({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "browse" });
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const goToBuilder = (customerId: string, extracted?: ReceiptExtractResult) => {
    if (extracted) {
      stashReceiptDraft({
        date: extracted.date,
        items: extracted.items,
        adjustments: extracted.adjustments,
        advanceAmount: extracted.advanceAmount,
        amountPaid: extracted.amountPaid,
        paymentMethods: extracted.paymentMethods,
      });
    }
    router.push(`/dashboard/receipts/new?customerId=${customerId}`);
  };

  const onFileSelected = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStage({ kind: "error", message: "Please upload an image (JPG or PNG)." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStage({ kind: "error", message: "Image is too large (max 8MB)." });
      return;
    }

    setStage({ kind: "extracting" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/receipts/extract", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Couldn't read that receipt image.");

      const extracted = json.data as ReceiptExtractResult;
      const match = findMatch(customers, extracted);
      if (match) {
        goToBuilder(match.id, extracted);
      } else {
        setStage({ kind: "needsCustomer", extracted });
      }
    } catch (e) {
      setStage({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  };

  // Let staff paste a screenshotted/copied receipt image (Ctrl+V) straight
  // in, as an alternative to picking a file — only while browsing, so a
  // stray paste doesn't interrupt the customer-confirmation step.
  useEffect(() => {
    if (stage.kind !== "browse") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        onFileSelected(file);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind]);

  const extractedDefaults = (extracted: ReceiptExtractResult): Partial<CustomerFormValues> => ({
    name: extracted.customerName ?? "",
    phone: extracted.phone ?? "",
    email: extracted.email ?? "",
    address: extracted.address ?? "",
  });

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">New Receipt</h1>
        <p className="text-stone-500 text-sm mt-1">Select a customer to continue</p>
      </div>

      {stage.kind === "needsCustomer" ? (
        <div className="card card-body">
          <h2 className="font-serif text-xl text-ink mb-1">Confirm customer details</h2>
          <p className="text-sm text-stone-500 mb-4">
            Couldn't match this to an existing customer — review the details read from the photo, then continue.
          </p>
          <AddCustomerForm
            defaultValues={extractedDefaults(stage.extracted)}
            submitLabel="Continue"
            onCreated={(customer) => goToBuilder(customer.id, stage.kind === "needsCustomer" ? stage.extracted : undefined)}
          />
          <button
            type="button"
            onClick={() => setStage({ kind: "browse" })}
            className="btn-ghost text-xs w-full mt-2 justify-center"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Upload a photo to auto-fill */}
          <div className="card card-body mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onFileSelected(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={stage.kind === "extracting"}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg py-5 text-sm text-stone-500 hover:border-amber-400 hover:text-amber-600 transition-colors disabled:opacity-60"
            >
              {stage.kind === "extracting" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Reading receipt…
                </>
              ) : (
                <>
                  <Upload size={16} /> Upload a receipt photo to auto-fill
                </>
              )}
            </button>
            {stage.kind !== "extracting" && (
              <p className="text-xs text-stone-400 text-center mt-2">or paste an image (Ctrl+V)</p>
            )}
            {stage.kind === "error" && (
              <p className="flex items-center justify-between text-xs text-red-500 mt-2">
                {stage.message}
                <button type="button" onClick={() => setStage({ kind: "browse" })} className="text-stone-400 hover:text-ink">
                  <X size={13} />
                </button>
              </p>
            )}
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
                  onClick={() => goToBuilder(c.id)}
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
        </>
      )}
    </div>
  );
}
