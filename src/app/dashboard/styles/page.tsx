import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { patternService, patternFiles } from "@/server/services/pattern.service";
import { PatternBulkUpload } from "@/components/styles/pattern-bulk-upload";
import { PatternReviewButton } from "@/components/styles/pattern-review-button";
import { PatternDeleteButton } from "@/components/styles/pattern-delete-button";
import { fmtDate } from "@/lib/utils/format";
import { FileDown, ImageOff } from "lucide-react";

export const metadata = { title: "Styles" };

function StatusBadge({ status }: { status: string }) {
  return status === "FINALIZED" ? (
    <span className="badge-completed">Finalized</span>
  ) : (
    <span className="badge-partial">Pending review</span>
  );
}

function FileLinks({ p }: { p: { moduleFileUrl: string | null; moduleFileName: string | null } }) {
  const files = patternFiles(p);
  if (files.length === 0) return <span className="text-xs text-stone-400">No files</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {files.map((f) => (
        <a key={f.label} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-amber-600 hover:underline truncate max-w-[220px]">
          <FileDown size={11} className="flex-none" />
          <span className="font-medium">{f.label}</span>
          <span className="text-stone-400 truncate">· {f.name}</span>
        </a>
      ))}
    </div>
  );
}

export default async function StylesPage() {
  const { id: userId, businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "STYLES")) return <SectionUnavailable section="Styles" />;

  const isPatternMaker = role === "PATTERN_MAKER";
  const isAdmin = role === "ADMIN";

  // Pattern Maker sees only their own uploads; Admin/Staff see all patterns.
  const patterns = await patternService.list(businessId, { onlyCreatedById: isPatternMaker ? userId : undefined });
  const pending = patterns.filter((p) => p.status !== "FINALIZED");
  const finalized = patterns.filter((p) => p.status === "FINALIZED");

  const canDelete = (p: { createdById: string; status: string }) =>
    isAdmin || (p.createdById === userId && p.status !== "FINALIZED");

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Styles</h1>
        <p className="text-stone-500 text-sm mt-1">
          {isPatternMaker
            ? "Upload your module files — an administrator reviews and finalizes each one."
            : "Review pending patterns (add a description + picture), then assign finalized ones to orders from the Production page."}
        </p>
      </div>

      <div className="mb-8">
        <PatternBulkUpload />
      </div>

      {/* -------- Pattern Maker: a single list of their own patterns -------- */}
      {isPatternMaker ? (
        <div className="card">
          <div className="card-header"><h2 className="text-sm font-semibold text-ink">My Patterns</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th text-left w-32">Pattern ID</th>
                  <th className="th text-left w-36">Status</th>
                  <th className="th text-left">Files</th>
                  <th className="th text-left">Date</th>
                  <th className="th text-center w-16"></th>
                </tr>
              </thead>
              <tbody>
                {patterns.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-stone-400 py-10">No patterns uploaded yet.</td></tr>
                )}
                {patterns.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                    <td className="td"><code className="font-mono text-sm font-semibold text-ink tracking-wide">{p.patternCode}</code></td>
                    <td className="td"><StatusBadge status={p.status} /></td>
                    <td className="td"><FileLinks p={p} /></td>
                    <td className="td text-xs text-stone-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    <td className="td text-center">
                      {canDelete(p) && <PatternDeleteButton patternId={p.id} patternCode={p.patternCode} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* -------- Admin/Staff: Pending review -------- */}
          <div className="card mb-8">
            <div className="card-header flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Pending review</h2>
              {pending.length > 0 && <span className="badge-partial">{pending.length}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th text-left w-32">Pattern ID</th>
                    <th className="th text-left">Files</th>
                    <th className="th text-left">Uploaded By</th>
                    <th className="th text-left">Date</th>
                    <th className="th text-right w-40">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 && (
                    <tr><td colSpan={5} className="td text-center text-stone-400 py-8">Nothing awaiting review.</td></tr>
                  )}
                  {pending.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                      <td className="td"><code className="font-mono text-sm font-semibold text-ink tracking-wide">{p.patternCode}</code></td>
                      <td className="td"><FileLinks p={p} /></td>
                      <td className="td text-xs text-stone-500">{p.createdBy.name ?? p.createdBy.email}</td>
                      <td className="td text-xs text-stone-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && <PatternReviewButton patternId={p.id} patternCode={p.patternCode} finalized={false} />}
                          {canDelete(p) && <PatternDeleteButton patternId={p.id} patternCode={p.patternCode} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* -------- Admin/Staff: Finalized -------- */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-ink">Finalized</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th text-left w-20">Picture</th>
                    <th className="th text-left w-32">Pattern ID</th>
                    <th className="th text-left">Description</th>
                    <th className="th text-left">Files</th>
                    <th className="th text-left">Date</th>
                    <th className="th text-center w-20">Assigned</th>
                    <th className="th text-right w-32">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {finalized.length === 0 && (
                    <tr><td colSpan={7} className="td text-center text-stone-400 py-8">No finalized patterns yet.</td></tr>
                  )}
                  {finalized.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                      <td className="td">
                        {p.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.imageUrl} alt="" className="w-12 h-12 object-cover rounded border border-stone-200 dark:border-stone-700" />
                        ) : (
                          <div className="w-12 h-12 rounded border border-dashed border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-300 dark:text-stone-600">
                            <ImageOff size={14} />
                          </div>
                        )}
                      </td>
                      <td className="td"><code className="font-mono text-sm font-semibold text-ink tracking-wide">{p.patternCode}</code></td>
                      <td className="td text-sm">{p.description}</td>
                      <td className="td"><FileLinks p={p} /></td>
                      <td className="td text-xs text-stone-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                      <td className="td text-center">
                        {p._count.items > 0 ? <span className="badge-completed">{p._count.items}</span> : <span className="text-xs text-stone-400">—</span>}
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && <PatternReviewButton patternId={p.id} patternCode={p.patternCode} currentDescription={p.description} finalized />}
                          {canDelete(p) && <PatternDeleteButton patternId={p.id} patternCode={p.patternCode} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
