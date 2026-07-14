"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderSync, FolderCheck, FolderX, Loader2, RefreshCw, SearchCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  isFolderSyncSupported,
  getFolderStatus,
  connectFolder,
  reconnectFolder,
  disconnectFolder,
  syncAll,
  diffFolders,
  type SyncItem,
  type FolderDiff,
} from "@/lib/folder-sync";

type State =
  | { kind: "unsupported" }
  | { kind: "loading" }
  | { kind: "disconnected" }
  | { kind: "needsPermission"; name: string }
  | { kind: "connected"; name: string };

export function FolderSyncPanel({ items }: { items: SyncItem[] }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [diff, setDiff] = useState<FolderDiff | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      setDiff(await diffFolders(items));
    } catch {
      setDiff(null);
    } finally {
      setChecking(false);
    }
  }, [items]);

  const refresh = useCallback(async () => {
    if (!isFolderSyncSupported()) return setState({ kind: "unsupported" });
    const s = await getFolderStatus();
    if (!s.connected) setState({ kind: "disconnected" });
    else if (s.needsPermission) setState({ kind: "needsPermission", name: s.name! });
    else {
      setState({ kind: "connected", name: s.name! });
      runCheck(); // auto-detect drift on load
    }
  }, [runCheck]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConnect = async () => {
    setMessage(null);
    try {
      const name = await connectFolder();
      setState({ kind: "connected", name });
      await runCheck();
    } catch {
      setMessage("Folder selection was cancelled.");
    }
  };

  const handleReconnect = async () => {
    setMessage(null);
    if (await reconnectFolder()) await refresh();
    else setMessage("Permission was denied.");
  };

  const handleSync = async () => {
    setBusy(true);
    setMessage(null);
    setProgress({ done: 0, total: items.length });
    try {
      const res = await syncAll(items, (done, total) => setProgress({ done, total }));
      setMessage(`Synced ${res.synced} invoice${res.synced === 1 ? "" : "s"}${res.failed ? `, ${res.failed} failed` : ""}.`);
      await runCheck();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleDisconnect = async () => {
    await disconnectFolder();
    setMessage(null);
    setDiff(null);
    setState({ kind: "disconnected" });
  };

  if (state.kind === "unsupported") {
    return (
      <div className="card card-body flex items-start gap-3">
        <FolderX size={18} className="text-stone-400 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-ink">Folder sync unavailable</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Saving orders to a folder on your computer needs Google Chrome or Microsoft Edge on desktop.
            The Bulk / Sample / Completed tabs below still work in any browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-body">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          {state.kind === "connected" ? (
            <FolderCheck size={18} className="text-emerald-500 mt-0.5" />
          ) : (
            <FolderSync size={18} className="text-stone-400 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium text-ink">
              {state.kind === "connected" && `Synced to “${state.name}”`}
              {state.kind === "needsPermission" && `Folder “${state.name}” — permission needed`}
              {state.kind === "disconnected" && "Sync invoices to a computer folder"}
              {state.kind === "loading" && "Checking folder…"}
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              {state.kind === "disconnected" &&
                "Pick a folder (e.g. D:\\MONTRA) — orders auto-file into Men's / Women's, then BULK ORDERS / Sample Orders / Completed."}
              {state.kind === "needsPermission" && "Re-grant access to continue writing to this folder."}
              {state.kind === "connected" && "Invoices move automatically when you record a payment on this computer."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state.kind === "disconnected" && (
            <button onClick={handleConnect} className="btn-primary">
              <FolderSync size={15} /> Connect folder
            </button>
          )}
          {state.kind === "needsPermission" && (
            <button onClick={handleReconnect} className="btn-primary">
              <RefreshCw size={15} /> Re-grant access
            </button>
          )}
          {state.kind === "connected" && (
            <>
              <button onClick={runCheck} disabled={busy || checking} className="btn-outline">
                {checking ? <Loader2 size={15} className="animate-spin" /> : <SearchCheck size={15} />}
                {checking ? "Checking…" : "Check for changes"}
              </button>
              <button onClick={handleSync} disabled={busy} className="btn-primary">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {busy ? "Syncing…" : "Sync now"}
              </button>
              <button onClick={handleDisconnect} disabled={busy} className="btn-ghost text-xs">
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Drift report */}
      {state.kind === "connected" && diff && !checking && (
        diff.changes === 0 ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={15} /> Folders match the app — {diff.upToDate} invoice{diff.upToDate === 1 ? "" : "s"} in place.
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-700">
            <AlertTriangle size={15} className="mt-0.5" />
            <span>
              <strong>{diff.changes}</strong> change{diff.changes === 1 ? "" : "s"} to apply
              {": "}
              {[
                diff.missing && `${diff.missing} to add`,
                diff.misfiled && `${diff.misfiled} to move`,
                diff.orphan && `${diff.orphan} extra`,
              ].filter(Boolean).join(", ")}
              . Click <strong>Sync now</strong> to update the folders.
            </span>
          </div>
        )
      )}

      {progress && (
        <div className="mt-3 h-1.5 rounded bg-stone-100 dark:bg-stone-700 overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      )}
      {message && <p className="text-xs text-stone-500 mt-2">{message}</p>}
    </div>
  );
}
