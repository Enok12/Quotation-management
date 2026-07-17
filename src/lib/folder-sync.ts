"use client";

import { FOLDER_NAMES, SYNCABLE_FOLDER_KEYS, CATEGORY_NAMES, ALL_CATEGORIES, type FolderKey, type Category } from "@/lib/order-folder";
import { receiptFileName } from "@/lib/utils/receipt-filename";

// ---------------------------------------------------------------------------
// Browser → local-disk folder sync (File System Access API, Chrome/Edge only).
//
// Mirrors receipts two levels deep on the user's computer:
//   <chosen folder>/Men's/BULK ORDERS, /Men's/Sample Orders, /Men's/Completed
//   <chosen folder>/Women's/BULK ORDERS, /Women's/Sample Orders, /Women's/Completed
// The user picks the root folder once (e.g. D:\MONTRA); the handle is kept in
// IndexedDB so it survives reloads. A change moves a receipt's PDF from its
// old path to the new one. "Sync all" reconciles every receipt.
//
// Note: the browser cannot target an absolute path itself — the user must pick
// the folder via the OS chooser. After that, everything is automatic.
// ---------------------------------------------------------------------------

export interface FolderPath {
  category: Category;
  folder: FolderKey;
}
export const ALL_PATHS: FolderPath[] = ALL_CATEGORIES.flatMap((category) =>
  SYNCABLE_FOLDER_KEYS.map((folder) => ({ category, folder })),
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

// e.g. "John Doe", 12 → "John_Doe-12.pdf"
const fileName = receiptFileName;

// Matches any "...-<digits>.pdf" filename so both the current naming and the
// older "receipt-<N>.pdf" naming are recognized by number (and cleaned up).
const RECEIPT_FILE = /-(\d+)\.pdf$/i;

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
  // Pre-create all six category/folder combinations so they appear immediately.
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

interface FolderFile { name: string; number: number }

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
    const m = name.match(RECEIPT_FILE);
    if (m) results.push({ name, number: Number(m[1]) });
  }
  return results;
}

/** Remove every file for this receipt number across all category/folder paths. */
async function removeAllCopies(root: DirHandle, receiptNumber: number) {
  for (const path of ALL_PATHS) {
    for (const f of await listFolderFiles(root, path)) {
      if (f.number !== receiptNumber) continue;
      try {
        const dir = await getPathDir(root, path, false);
        await dir?.removeEntry(f.name);
      } catch {
        /* ignore */
      }
    }
  }
}

async function placeInvoice(root: DirHandle, receiptId: string, receiptNumber: number, custName: string, path: FolderPath) {
  const bytes = await fetchInvoicePdf(receiptId);

  // Clear out any existing copy first (old naming, wrong path, or both).
  await removeAllCopies(root, receiptNumber);

  const dir = await getPathDir(root, path, true);
  if (!dir) throw new Error(`Could not create ${pathLabel(path)}`);
  const file = await dir.getFileHandle(fileName(receiptNumber, custName), { create: true });
  const writable = await file.createWritable();
  await writable.write(bytes);
  await writable.close();
}

/**
 * Best-effort move used right after a payment. Silently no-ops if the folder
 * isn't connected or permission isn't currently granted — "Sync all" will
 * reconcile it later. Never throws to the caller's happy path.
 */
export async function moveInvoiceIfConnected(
  receiptId: string,
  receiptNumber: number,
  custName: string,
  category: Category,
  folder: FolderKey,
): Promise<boolean> {
  try {
    const handle = await getSavedHandle();
    if (!handle || !(await hasPermission(handle))) return false;
    await placeInvoice(handle, receiptId, receiptNumber, custName, { category, folder });
    return true;
  } catch {
    return false;
  }
}

/** Remove a receipt's PDF from every folder (used when a receipt is deleted). */
export async function removeInvoiceFromFolders(receiptNumber: number): Promise<boolean> {
  try {
    const handle = await getSavedHandle();
    if (!handle || !(await hasPermission(handle))) return false;
    await removeAllCopies(handle, receiptNumber);
    return true;
  } catch {
    return false;
  }
}

export interface SyncItem {
  id: string;
  receiptNumber: number;
  custName: string;
  category: Category;
  folder: FolderKey;
}

export interface DiffDetail {
  receiptNumber: number;
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
 */
export async function diffFolders(items: SyncItem[]): Promise<FolderDiff> {
  const handle = await getSavedHandle();
  if (!handle) throw new Error("No folder connected");
  if (!(await hasPermission(handle))) throw new Error("Folder permission needed");

  // Snapshot current disk state per path, by receipt number (naming-agnostic).
  const present: Record<string, Set<number>> = {};
  for (const path of ALL_PATHS) {
    present[pathKey(path)] = new Set((await listFolderFiles(handle, path)).map((f) => f.number));
  }

  // Expected: receiptNumber → path it should live in.
  const expected = new Map<number, FolderPath>();
  for (const it of items) expected.set(it.receiptNumber, { category: it.category, folder: it.folder });

  let upToDate = 0, missing = 0, misfiled = 0, orphan = 0;
  const details: DiffDetail[] = [];

  for (const [num, targetPath] of expected) {
    const targetKey = pathKey(targetPath);
    const inTarget = present[targetKey]?.has(num) ?? false;
    const elsewhere = ALL_PATHS.find((p) => pathKey(p) !== targetKey && present[pathKey(p)]?.has(num));

    if (inTarget && !elsewhere) {
      upToDate++;
    } else if (!inTarget && !elsewhere) {
      missing++;
      details.push({ receiptNumber: num, issue: "missing", to: pathLabel(targetPath) });
    } else {
      misfiled++;
      details.push({ receiptNumber: num, issue: "misfiled", from: elsewhere && pathLabel(elsewhere), to: pathLabel(targetPath) });
    }
  }

  // Files on disk for receipts the app doesn't know about.
  for (const path of ALL_PATHS) {
    for (const num of present[pathKey(path)]) {
      if (!expected.has(num)) {
        orphan++;
        details.push({ receiptNumber: num, issue: "orphan", from: pathLabel(path) });
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

/** Reconcile every invoice into the path matching its current status. */
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
      await placeInvoice(handle, items[i].id, items[i].receiptNumber, items[i].custName, {
        category: items[i].category, folder: items[i].folder,
      });
      synced++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, items.length);
  }

  // Remove orphaned receipt PDFs (no matching invoice in the app anymore).
  const known = new Set(items.map((it) => it.receiptNumber));
  for (const path of ALL_PATHS) {
    for (const f of await listFolderFiles(handle, path)) {
      if (!known.has(f.number)) {
        try {
          const dir = await getPathDir(handle, path, false);
          await dir?.removeEntry(f.name);
        } catch {
          /* ignore */
        }
      }
    }
  }

  return { synced, failed, total: items.length };
}
