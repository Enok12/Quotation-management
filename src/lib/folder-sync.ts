"use client";

import { FOLDER_NAMES, ALL_FOLDER_KEYS, CATEGORY_NAMES, ALL_CATEGORIES, type FolderKey, type Category } from "@/lib/order-folder";
import { receiptFileName, draftReceiptFileName } from "@/lib/utils/receipt-filename";
import { SAMPLE_PREFIX, receiptNumberLabel, type ReceiptOrderType } from "@/lib/utils/receipt-number";

// ---------------------------------------------------------------------------
// Browser → local-disk folder sync (File System Access API, Chrome/Edge only).
//
// Mirrors receipts two levels deep on the user's computer:
//   <chosen folder>/Men's/Unconfirmed, /Men's/BULK ORDERS, /Men's/Sample Orders, /Men's/Completed
//   <chosen folder>/Women's/Unconfirmed, /Women's/BULK ORDERS, /Women's/Sample Orders, /Women's/Completed
// The user picks the root folder once (e.g. D:\MONTRA); the handle is kept in
// IndexedDB so it survives reloads. A change moves a receipt's PDF from its
// old path to the new one. "Sync all" reconciles every receipt.
//
// Confirmed receipts are tracked by their invoice number (embedded in the
// filename). An Unconfirmed receipt has no number yet, so its draft PDF is
// tracked by its own id instead — a completely separate identity scheme that
// only ever lives in the Unconfirmed folder. Confirming an order removes the
// draft (by id) and places the real numbered file, in one step.
//
// Note: the browser cannot target an absolute path itself — the user must pick
// the folder via the OS chooser. After that, everything is automatic.
// ---------------------------------------------------------------------------

export interface FolderPath {
  category: Category;
  folder: FolderKey;
}
export const ALL_PATHS: FolderPath[] = ALL_CATEGORIES.flatMap((category) =>
  ALL_FOLDER_KEYS.map((folder) => ({ category, folder })),
);
const pathKey = (p: FolderPath) => `${p.category}:${p.folder}`;
const pathLabel = (p: FolderPath) => `${CATEGORY_NAMES[p.category]} / ${FOLDER_NAMES[p.folder]}`;

// Minimal shape of the File System Access API bits we use (not in older TS lib.dom).
type PermState = "granted" | "denied" | "prompt";
interface DirHandle {
  name: string;
  queryPermission(o: { mode: "readwrite" }): Promise<PermState>;
  requestPermission(o: { mode: "readwrite" }): Promise<PermState>;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry(name: string, o?: { recursive?: boolean }): Promise<void>;
  keys(): AsyncIterableIterator<string>;
}
interface FileHandleLike {
  createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void> }>;
}

export function isFolderSyncSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// e.g. "John Doe", 12, "BULK" → "12-John_Doe.pdf"
const fileName = receiptFileName;

// A numbered file's identity is (orderType, number), NOT number alone — Bulk
// and Sample are separate sequences, so "1-Kamal.pdf" and "S-01-Kamal.pdf"
// are two different orders that must never be mistaken for each other.
// Matching on the number alone would make placing Bulk #1 delete Sample #1's
// PDF (and vice versa), and would make orphan cleanup remove live files.
const SAMPLE_FILE = new RegExp(`^${SAMPLE_PREFIX}(\\d+)-.*\\.pdf$`, "i");
// Bulk: the current "<N>-Customer_Name.pdf" naming (number leads), or an
// older naming with the number trailing ("Customer_Name-<N>.pdf", or the
// original "receipt-<N>.pdf"), so files synced under a previous scheme are
// still recognized and get renamed in place rather than duplicated. Every
// legacy-named file is Bulk by definition — Samples never had numbers before
// the sequences were split.
const BULK_FILE = /^(\d+)-.*\.pdf$|-(\d+)\.pdf$/i;

interface ParsedReceiptFile { number: number; orderType: ReceiptOrderType }

function parseReceiptFile(name: string): ParsedReceiptFile | null {
  // Sample is checked first: "S-01-Name.pdf" must not fall through to the
  // bulk patterns.
  const sample = name.match(SAMPLE_FILE);
  if (sample) return { number: Number(sample[1]), orderType: "SAMPLE" };
  const bulk = name.match(BULK_FILE);
  if (bulk) return { number: Number(bulk[1] ?? bulk[2]), orderType: "BULK" };
  return null;
}

/** Stable key for "this exact invoice", across both sequences. */
const invoiceKey = (number: number, orderType: ReceiptOrderType) => `${orderType}:${number}`;

// Draft (Unconfirmed) files are keyed by the receipt's own id, not a number.
const DRAFT_FILE = /-draft-([a-zA-Z0-9]+)\.pdf$/i;

// ----------------------------- IndexedDB ----------------------------------
const DB_NAME = "montra-folder-sync";
const STORE = "handles";
const KEY = "root";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --------------------------- Handle + permission --------------------------
async function getSavedHandle(): Promise<DirHandle | null> {
  try {
    return (await idbGet<DirHandle>(KEY)) ?? null;
  } catch {
    return null;
  }
}

async function hasPermission(handle: DirHandle): Promise<boolean> {
  try {
    return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

/** Current connection status — call on mount to show the right UI. */
export async function getFolderStatus(): Promise<{ connected: boolean; name?: string; needsPermission?: boolean }> {
  const handle = await getSavedHandle();
  if (!handle) return { connected: false };
  const ok = await hasPermission(handle);
  return { connected: true, name: handle.name, needsPermission: !ok };
}

/** Prompt the user to pick a root folder (must be called from a click). */
export async function connectFolder(): Promise<string> {
  // @ts-expect-error showDirectoryPicker is not yet in the TS lib types
  const handle: DirHandle = await window.showDirectoryPicker({ id: "montra-invoices", mode: "readwrite" });
  await handle.requestPermission({ mode: "readwrite" });
  // Pre-create all eight category/folder combinations (including Unconfirmed)
  // so they appear immediately, even though Unconfirmed starts empty.
  for (const path of ALL_PATHS) {
    const categoryDir = await handle.getDirectoryHandle(CATEGORY_NAMES[path.category], { create: true });
    await categoryDir.getDirectoryHandle(FOLDER_NAMES[path.folder], { create: true });
  }
  await idbSet(KEY, handle);
  return handle.name;
}

/** Re-request permission on a previously chosen folder (from a click). */
export async function reconnectFolder(): Promise<boolean> {
  const handle = await getSavedHandle();
  if (!handle) return false;
  const res = await handle.requestPermission({ mode: "readwrite" });
  return res === "granted";
}

export async function disconnectFolder(): Promise<void> {
  await idbDel(KEY);
}

// ------------------------------- File ops ---------------------------------
async function fetchInvoicePdf(receiptId: string): Promise<ArrayBuffer> {
  const res = await fetch(`/api/v1/receipts/${receiptId}/generate-pdf?silent=1`, { method: "POST" });
  if (!res.ok) throw new Error("Could not generate the invoice PDF");
  return res.arrayBuffer();
}

interface FolderFile { name: string; number: number; orderType: ReceiptOrderType }

/** Get the (category, folder) directory two levels down from root. */
async function getPathDir(root: DirHandle, path: FolderPath, create: boolean): Promise<DirHandle | null> {
  try {
    const categoryDir = await root.getDirectoryHandle(CATEGORY_NAMES[path.category], { create });
    return await categoryDir.getDirectoryHandle(FOLDER_NAMES[path.folder], { create });
  } catch {
    return null; // not created yet (and create: false)
  }
}

/** List every receipt-numbered PDF currently in one (category, folder) path. */
async function listFolderFiles(root: DirHandle, path: FolderPath): Promise<FolderFile[]> {
  const results: FolderFile[] = [];
  const dir = await getPathDir(root, path, false);
  if (!dir) return results;
  for await (const name of dir.keys()) {
    const parsed = parseReceiptFile(name);
    if (parsed) results.push({ name, number: parsed.number, orderType: parsed.orderType });
  }
  return results;
}

/** The set of receipt ids with a draft file currently in one (category, folder) path. */
async function listDraftIds(root: DirHandle, path: FolderPath): Promise<Set<string>> {
  const ids = new Set<string>();
  const dir = await getPathDir(root, path, false);
  if (!dir) return ids;
  for await (const name of dir.keys()) {
    const m = name.match(DRAFT_FILE);
    if (m) ids.add(m[1]);
  }
  return ids;
}

/**
 * Remove every file for this exact invoice across all category/folder paths.
 * Matches on BOTH number and order type — Bulk #1 and Sample #1 are different
 * orders, so this must never touch the other sequence's file.
 */
async function removeAllCopies(root: DirHandle, receiptNumber: number, orderType: ReceiptOrderType) {
  for (const path of ALL_PATHS) {
    for (const f of await listFolderFiles(root, path)) {
      if (f.number !== receiptNumber || f.orderType !== orderType) continue;
      try {
        const dir = await getPathDir(root, path, false);
        await dir?.removeEntry(f.name);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Remove this receipt's draft file wherever it currently sits (normally just Unconfirmed). */
async function removeDraftCopy(root: DirHandle, receiptId: string) {
  for (const path of ALL_PATHS) {
    const dir = await getPathDir(root, path, false);
    if (!dir) continue;
    for await (const name of dir.keys()) {
      const m = name.match(DRAFT_FILE);
      if (m && m[1] === receiptId) {
        try {
          await dir.removeEntry(name);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

async function placeInvoice(
  root: DirHandle,
  receiptId: string,
  receiptNumber: number | null,
  custName: string,
  orderType: ReceiptOrderType,
  path: FolderPath,
) {
  const bytes = await fetchInvoicePdf(receiptId);

  // Clear out any existing draft first — this call may be the exact moment an
  // order gets confirmed (draft → numbered), or just a redundant re-place.
  await removeDraftCopy(root, receiptId);
  if (receiptNumber !== null) await removeAllCopies(root, receiptNumber, orderType);

  const dir = await getPathDir(root, path, true);
  if (!dir) throw new Error(`Could not create ${pathLabel(path)}`);
  const name = receiptNumber !== null ? fileName(receiptNumber, custName, orderType) : draftReceiptFileName(receiptId, custName);
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(bytes);
  await writable.close();
}

/**
 * Best-effort move used right after a payment (or creation/edit). Silently
 * no-ops if the folder isn't connected or permission isn't currently granted
 * — "Sync all" will reconcile it later. Never throws to the caller's happy path.
 */
export async function moveInvoiceIfConnected(
  receiptId: string,
  receiptNumber: number | null,
  custName: string,
  orderType: ReceiptOrderType,
  category: Category,
  folder: FolderKey,
): Promise<boolean> {
  try {
    const handle = await getSavedHandle();
    if (!handle || !(await hasPermission(handle))) return false;
    await placeInvoice(handle, receiptId, receiptNumber, custName, orderType, { category, folder });
    return true;
  } catch {
    return false;
  }
}

/** Remove a receipt's PDF (draft or numbered) from every folder — used when a receipt is deleted. */
export async function removeInvoiceFromFolders(
  receiptId: string,
  receiptNumber: number | null,
  orderType: ReceiptOrderType,
): Promise<boolean> {
  try {
    const handle = await getSavedHandle();
    if (!handle || !(await hasPermission(handle))) return false;
    await removeDraftCopy(handle, receiptId);
    if (receiptNumber !== null) await removeAllCopies(handle, receiptNumber, orderType);
    return true;
  } catch {
    return false;
  }
}

export interface SyncItem {
  id: string;
  receiptNumber: number | null;
  custName: string;
  orderType: ReceiptOrderType;
  category: Category;
  folder: FolderKey;
}

export interface DiffDetail {
  label: string; // "#12" / "S-01" for a confirmed receipt, "Unconfirmed order" for a draft
  issue: "missing" | "misfiled" | "orphan";
  from?: string;
  to?: string;
}

export interface FolderDiff {
  upToDate: number;
  missing: number;   // app expects it on disk, not there
  misfiled: number;  // on disk but in the wrong path
  orphan: number;    // on disk with no matching invoice
  changes: number;   // missing + misfiled + orphan
  details: DiffDetail[];
}

/**
 * Compare the on-disk folders against what the app expects, without changing
 * anything. Returns a breakdown of how many invoices are out of sync.
 * Numbered (confirmed) and draft (Unconfirmed) files are tracked separately —
 * they're different identity schemes that never collide.
 */
export async function diffFolders(items: SyncItem[]): Promise<FolderDiff> {
  const handle = await getSavedHandle();
  if (!handle) throw new Error("No folder connected");
  if (!(await hasPermission(handle))) throw new Error("Folder permission needed");

  // Keyed by "ORDERTYPE:number", never number alone — Bulk #1 and Sample #1
  // are different invoices and must diff independently.
  const presentNumbers: Record<string, Set<string>> = {};
  const presentDrafts: Record<string, Set<string>> = {};
  for (const path of ALL_PATHS) {
    presentNumbers[pathKey(path)] = new Set(
      (await listFolderFiles(handle, path)).map((f) => invoiceKey(f.number, f.orderType)),
    );
    presentDrafts[pathKey(path)] = await listDraftIds(handle, path);
  }

  const expectedNumbered = new Map<string, { path: FolderPath; label: string }>();
  const expectedDrafts = new Map<string, FolderPath>();
  for (const it of items) {
    const path = { category: it.category, folder: it.folder };
    if (it.receiptNumber !== null) {
      expectedNumbered.set(invoiceKey(it.receiptNumber, it.orderType), {
        path,
        label: receiptNumberLabel(it.receiptNumber, it.orderType),
      });
    } else {
      expectedDrafts.set(it.id, path);
    }
  }

  let upToDate = 0, missing = 0, misfiled = 0, orphan = 0;
  const details: DiffDetail[] = [];

  for (const [key, { path: targetPath, label }] of expectedNumbered) {
    const targetKey = pathKey(targetPath);
    const inTarget = presentNumbers[targetKey]?.has(key) ?? false;
    const elsewhere = ALL_PATHS.find((p) => pathKey(p) !== targetKey && presentNumbers[pathKey(p)]?.has(key));
    if (inTarget && !elsewhere) {
      upToDate++;
    } else if (!inTarget && !elsewhere) {
      missing++;
      details.push({ label, issue: "missing", to: pathLabel(targetPath) });
    } else {
      misfiled++;
      details.push({ label, issue: "misfiled", from: elsewhere && pathLabel(elsewhere), to: pathLabel(targetPath) });
    }
  }

  for (const [id, targetPath] of expectedDrafts) {
    const targetKey = pathKey(targetPath);
    const inTarget = presentDrafts[targetKey]?.has(id) ?? false;
    const elsewhere = ALL_PATHS.find((p) => pathKey(p) !== targetKey && presentDrafts[pathKey(p)]?.has(id));
    if (inTarget && !elsewhere) {
      upToDate++;
    } else if (!inTarget && !elsewhere) {
      missing++;
      details.push({ label: "Unconfirmed order", issue: "missing", to: pathLabel(targetPath) });
    } else {
      misfiled++;
      details.push({ label: "Unconfirmed order", issue: "misfiled", from: elsewhere && pathLabel(elsewhere), to: pathLabel(targetPath) });
    }
  }

  // Files on disk for receipts the app doesn't know about.
  for (const path of ALL_PATHS) {
    for (const key of presentNumbers[pathKey(path)]) {
      if (!expectedNumbered.has(key)) {
        orphan++;
        const [type, num] = key.split(":");
        details.push({ label: receiptNumberLabel(Number(num), type as ReceiptOrderType), issue: "orphan", from: pathLabel(path) });
      }
    }
    for (const id of presentDrafts[pathKey(path)]) {
      if (!expectedDrafts.has(id)) {
        orphan++;
        details.push({ label: "Unconfirmed order", issue: "orphan", from: pathLabel(path) });
      }
    }
  }

  return { upToDate, missing, misfiled, orphan, changes: missing + misfiled + orphan, details };
}

export interface SyncResult {
  synced: number;
  failed: number;
  total: number;
}

/** Reconcile every invoice (confirmed or Unconfirmed draft) into the path matching its current status. */
export async function syncAll(items: SyncItem[], onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const handle = await getSavedHandle();
  if (!handle) throw new Error("No folder connected");
  if (!(await hasPermission(handle))) {
    const granted = (await handle.requestPermission({ mode: "readwrite" })) === "granted";
    if (!granted) throw new Error("Folder permission was denied");
  }

  let synced = 0, failed = 0;
  for (let i = 0; i < items.length; i++) {
    try {
      await placeInvoice(handle, items[i].id, items[i].receiptNumber, items[i].custName, items[i].orderType, {
        category: items[i].category, folder: items[i].folder,
      });
      synced++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, items.length);
  }

  // Remove orphaned files — numbered ones with no matching receipt, and
  // drafts for receipts that are no longer Unconfirmed (or gone entirely).
  // Keyed by type+number: keying by number alone would treat Sample #1 as
  // "known" because Bulk #1 exists (leaving a stale file behind), and would
  // delete a live file whenever only the other sequence had that number.
  const knownInvoices = new Set(
    items.filter((it) => it.receiptNumber !== null).map((it) => invoiceKey(it.receiptNumber as number, it.orderType)),
  );
  const knownDraftIds = new Set(items.filter((it) => it.receiptNumber === null).map((it) => it.id));
  for (const path of ALL_PATHS) {
    for (const f of await listFolderFiles(handle, path)) {
      if (!knownInvoices.has(invoiceKey(f.number, f.orderType))) {
        try {
          const dir = await getPathDir(handle, path, false);
          await dir?.removeEntry(f.name);
        } catch {
          /* ignore */
        }
      }
    }
    const dir = await getPathDir(handle, path, false);
    if (dir) {
      for await (const name of dir.keys()) {
        const m = name.match(DRAFT_FILE);
        if (m && !knownDraftIds.has(m[1])) {
          try {
            await dir.removeEntry(name);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  return { synced, failed, total: items.length };
}
