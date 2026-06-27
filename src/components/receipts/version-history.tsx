import { fmtDateTime } from "@/lib/utils/format";
import Link from "next/link";

interface Version { id: string; versionNumber: number; changeSummary: string | null; createdAt: Date }

export function VersionHistory({ versions, receiptId }: { versions: Version[]; receiptId: string }) {
  return (
    <div>
      <h2 className="heading-2 mb-3">Version History</h2>
      <div className="space-y-2">
        {versions.map((v) => (
          <div key={v.id} className="text-xs border-l-2 border-amber-300 pl-3 py-1">
            <div className="font-semibold text-ink">v{v.versionNumber}</div>
            <div className="text-stone-400">{fmtDateTime(v.createdAt)}</div>
            {v.changeSummary && <div className="text-stone-500 mt-0.5">{v.changeSummary}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
