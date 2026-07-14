"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, Loader2, X, Check, RefreshCw, ArrowRight, ArrowLeft, Trash2, Search } from "lucide-react";
import { AddCustomerForm } from "@/components/customers/add-customer-form";
import { stashReceiptDraft } from "@/lib/receipt-draft";
import { findCustomerMatch, type MatchableCustomer } from "@/lib/customer-match";
import { loadBatch, saveBatch, clearBatch, type BatchItem, type BatchKind } from "@/lib/receipt-batch";
import { runWithConcurrency } from "@/lib/utils/concurrency";
import { MAX_UPLOAD_BYTES, MAX_BATCH_FILES, isAcceptedReceiptFile } from "@/lib/receipt-upload-limits";
import { CATEGORY_NAMES } from "@/lib/order-folder";
import type { ReceiptExtractResult } from "@/lib/validation/receipt-extract.schema";

// Kept low deliberately — this is what keeps a batch of many files from
// tripping Gemini's free-tier per-minute rate limit. Two in flight at a time,
// with a stagger between dispatches, instead of firing every request at once.
const CONCURRENCY = 2;
const STAGGER_MS = 400;

export function BulkUploadShell({
  customers,
  completedItemId,
  orderType,
}: {
  customers: MatchableCustomer[];
  completedItemId?: string;
  /** Every receipt reviewed from this queue is created as this order type —
   * there's no per-item toggle, since the two queues are entered separately. */
  orderType: "BULK" | "SAMPLE";
}) {
  const router = useRouter();
  const isSample = orderType === "SAMPLE";
  const kind: BatchKind = isSample ? "sample" : "bulk";
  const basePath = isSample ? "/dashboard/receipts/new/bulk-sample" : "/dashboard/receipts/new/bulk";

  const [items, setItems] = useState<BatchItem[]>([]);
  const [sessionCustomers, setSessionCustomers] = useState<MatchableCustomer[]>([]);
  const filesRef = useRef<Map<string, File>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customerPromptId, setCustomerPromptId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);

  const closePrompt = () => {
    setCustomerPromptId(null);
    setPickerSearch("");
  };

  // Restore any in-progress/completed batch (this is a real page navigation
  // to/from the builder, so it doesn't survive in React state alone), and
  // mark whichever item we just came back from as done.
  useEffect(() => {
    const loaded = loadBatch(kind);
    if (completedItemId) {
      const next = loaded.map((it) => (it.id === completedItemId ? { ...it, status: "done" as const } : it));
      setItems(next);
      saveBatch(kind, next);
      router.replace(basePath);
    } else {
      setItems(loaded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setItems((prev) => {
      const next = prev.map((it) => (it.id === id ? { ...it, ...patch } : it));
      saveBatch(kind, next);
      return next;
    });
  };

  const extractOne = async (item: BatchItem) => {
    const file = filesRef.current.get(item.id);
    if (!file) {
      updateItem(item.id, { status: "failed", error: "File no longer available — remove and re-add it." });
      return;
    }
    updateItem(item.id, { status: "extracting" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/receipts/extract", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Couldn't read that receipt.");

      const extracted = json.data as ReceiptExtractResult;
      // Include customers created earlier in this same batch — e.g. two
      // receipts for the same person, uploaded together.
      const match = findCustomerMatch([...customers, ...sessionCustomers], extracted);
      if (match) {
        updateItem(item.id, { status: "matched", extracted, matchedCustomerId: match.id, matchedCustomerName: match.name });
      } else {
        updateItem(item.id, { status: "needsCustomer", extracted });
      }
    } catch (e) {
      updateItem(item.id, { status: "failed", error: e instanceof Error ? e.message : "Something went wrong." });
    }
  };

  const runExtraction = (toRun: BatchItem[]) => {
    if (toRun.length > 0) void runWithConcurrency(toRun, CONCURRENCY, STAGGER_MS, extractOne);
  };

  const addFiles = (fileList: FileList) => {
    setBatchError(null);
    const incoming = Array.from(fileList);
    const room = MAX_BATCH_FILES - items.length;
    if (incoming.length > room) {
      setBatchError(
        room > 0
          ? `Only ${room} more file${room === 1 ? "" : "s"} will fit in this batch (max ${MAX_BATCH_FILES} at a time) — the rest were skipped.`
          : `This batch is already full (max ${MAX_BATCH_FILES} at a time). Review or clear some items first.`,
      );
    }
    const candidates = incoming.slice(0, Math.max(0, room));

    const newItems: BatchItem[] = [];
    for (const file of candidates) {
      if (!isAcceptedReceiptFile(file) || file.size > MAX_UPLOAD_BYTES) continue;
      const id = crypto.randomUUID();
      filesRef.current.set(id, file);
      newItems.push({ id, fileName: file.name, status: "pending" });
    }
    if (newItems.length === 0) return;

    setItems((prev) => {
      const next = [...prev, ...newItems];
      saveBatch(kind, next);
      return next;
    });
    runExtraction(newItems);
  };

  const retry = (item: BatchItem) => runExtraction([item]);
  const retryAllFailed = () => runExtraction(items.filter((it) => it.status === "failed"));

  const removeItem = (id: string) => {
    filesRef.current.delete(id);
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      saveBatch(kind, next);
      return next;
    });
  };

  const goToBuilder = (customerId: string, item: BatchItem) => {
    if (item.extracted) {
      stashReceiptDraft({
        date: item.extracted.date,
        items: item.extracted.items,
        adjustments: item.extracted.adjustments,
        advanceAmount: item.extracted.advanceAmount,
        amountPaid: item.extracted.amountPaid,
        paymentMethods: item.extracted.paymentMethods,
        isSample,
        category: item.extracted.category,
      });
    }
    router.push(
      `/dashboard/receipts/new?customerId=${customerId}&batchItem=${item.id}&batchReturn=${encodeURIComponent(basePath)}`,
    );
  };

  const review = (item: BatchItem) => {
    if (item.status === "matched" && item.matchedCustomerId) {
      goToBuilder(item.matchedCustomerId, item);
      return;
    }
    if (item.status === "needsCustomer") {
      // Re-check now, not just at extraction time — a customer created from
      // an earlier item in this same batch (e.g. the same person's other
      // receipts) may match even though it didn't exist yet when this item
      // was first read.
      const recheck = item.extracted && findCustomerMatch([...customers, ...sessionCustomers], item.extracted);
      if (recheck) {
        updateItem(item.id, { status: "matched", matchedCustomerId: recheck.id, matchedCustomerName: recheck.name });
        goToBuilder(recheck.id, item);
        return;
      }
      setCustomerPromptId(item.id);
    }
  };

  const clearAll = () => {
    filesRef.current.clear();
    setItems([]);
    clearBatch(kind);
  };

  const promptItem = items.find((it) => it.id === customerPromptId) ?? null;
  const doneCount = items.filter((it) => it.status === "done").length;

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-3xl">
      <Link href="/dashboard/receipts/new" className="btn-ghost text-xs mb-4 inline-flex">
        <ArrowLeft size={14} /> Back to single upload
      </Link>

      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Bulk Upload {isSample ? "Sample" : "Bulk"} Orders</h1>
        <p className="text-stone-500 text-sm mt-1">
          Upload several receipt photos or PDFs at once — every one is created as a {isSample ? "sample" : "bulk"} order.
          Each is read and matched to a customer independently, then reviewed and saved one at a time.
        </p>
      </div>

      <div className="card card-body mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-lg py-5 text-sm text-stone-500 hover:border-amber-400 hover:text-amber-600 transition-colors"
        >
          <Upload size={16} /> Add receipt photos or PDFs
        </button>
        <p className="text-xs text-stone-400 text-center mt-2">
          Up to {MAX_BATCH_FILES} files at a time — processed a couple at a time to stay within the free extraction quota.
        </p>
        {batchError && (
          <p className="flex items-center justify-between text-xs text-red-500 mt-2">
            {batchError}
            <button type="button" onClick={() => setBatchError(null)} className="text-stone-400 hover:text-ink"><X size={13} /></button>
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-ink">{doneCount} of {items.length} reviewed</h2>
            <div className="flex items-center gap-2">
              {items.some((it) => it.status === "failed") && (
                <button type="button" onClick={retryAllFailed} className="btn-ghost text-xs py-1">
                  <RefreshCw size={12} /> Retry failed
                </button>
              )}
              <button type="button" onClick={clearAll} className="btn-ghost text-xs py-1">
                <Trash2 size={12} /> Clear all
              </button>
            </div>
          </div>
          <ul className="divide-y divide-stone-100 dark:divide-stone-700">
            {items.map((item) => (
              <li key={item.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{item.fileName}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {item.status === "pending" && "Waiting…"}
                    {item.status === "extracting" && "Reading receipt…"}
                    {item.status === "matched" && (
                      <>
                        Matched to <span className="text-ink">{item.matchedCustomerName}</span> · {item.extracted?.items.length ?? 0} item{item.extracted?.items.length === 1 ? "" : "s"}
                        {item.extracted?.category && ` · ${CATEGORY_NAMES[item.extracted.category]} (guessed)`}
                      </>
                    )}
                    {item.status === "needsCustomer" && (
                      <>
                        New customer{item.extracted?.customerName ? `: ${item.extracted.customerName}` : ""} · {item.extracted?.items.length ?? 0} item{item.extracted?.items.length === 1 ? "" : "s"}
                        {item.extracted?.category && ` · ${CATEGORY_NAMES[item.extracted.category]} (guessed)`}
                      </>
                    )}
                    {item.status === "failed" && <span className="text-red-500">{item.error ?? "Failed to read"}</span>}
                    {item.status === "done" && "Saved"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  {(item.status === "pending" || item.status === "extracting") && (
                    <Loader2 size={16} className="animate-spin text-stone-400" />
                  )}
                  {item.status === "done" && <Check size={16} className="text-emerald-500" />}
                  {item.status === "failed" && (
                    <button type="button" onClick={() => retry(item)} className="btn-ghost text-xs py-1">
                      <RefreshCw size={12} /> Retry
                    </button>
                  )}
                  {(item.status === "matched" || item.status === "needsCustomer") && (
                    <button type="button" onClick={() => review(item)} className="btn-outline text-xs py-1">
                      Review <ArrowRight size={12} />
                    </button>
                  )}
                  {item.status !== "extracting" && item.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      title="Remove"
                      aria-label="Remove"
                      className="text-stone-300 hover:text-red-400 transition-colors p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {promptItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={closePrompt}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-lg p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl text-ink">Confirm customer details</h3>
                <p className="text-sm text-stone-500 mt-0.5">{promptItem.fileName} — couldn't match to an existing customer.</p>
              </div>
              <button onClick={closePrompt} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            {/* Manual fallback — e.g. the same person's other receipts in this
                batch didn't auto-match (phone read slightly differently). */}
            <div className="mb-4">
              <label className="field-label">Or pick an existing customer</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="field-input pl-9 text-sm"
                />
              </div>
              {pickerSearch.trim() && (
                <ul className="mt-2 border border-stone-200 dark:border-stone-700 rounded-md divide-y divide-stone-100 dark:divide-stone-700 max-h-40 overflow-y-auto">
                  {[...customers, ...sessionCustomers]
                    .filter((c) => c.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()) || (c.phone ?? "").includes(pickerSearch.trim()))
                    .slice(0, 6)
                    .map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            closePrompt();
                            goToBuilder(c.id, promptItem);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-stone-50 dark:hover:bg-white/5 transition-colors text-left"
                        >
                          <span className="text-ink">{c.name}</span>
                          <span className="text-xs text-stone-400">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  {[...customers, ...sessionCustomers].filter((c) => c.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()) || (c.phone ?? "").includes(pickerSearch.trim())).length === 0 && (
                    <li className="px-3 py-2 text-sm text-stone-400">No matches</li>
                  )}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-stone-100 dark:bg-stone-700" />
              <span className="text-xs text-stone-400">or create a new customer</span>
              <div className="flex-1 h-px bg-stone-100 dark:bg-stone-700" />
            </div>

            <AddCustomerForm
              defaultValues={{
                name: promptItem.extracted?.customerName ?? "",
                phone: promptItem.extracted?.phone ?? "",
                email: promptItem.extracted?.email ?? "",
                address: promptItem.extracted?.address ?? "",
              }}
              submitLabel="Continue"
              onCreated={(customer) => {
                setSessionCustomers((prev) => [...prev, customer]);
                closePrompt();
                goToBuilder(customer.id, promptItem);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
