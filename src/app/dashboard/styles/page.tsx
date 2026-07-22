import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { patternService } from "@/server/services/pattern.service";
import { PatternUploadForm } from "@/components/styles/pattern-upload-form";
import { fmtDate } from "@/lib/utils/format";
import { FileDown, ImageOff } from "lucide-react";

export const metadata = { title: "Styles" };

export default async function StylesPage() {
  const { id: userId, businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "STYLES")) return <SectionUnavailable section="Styles" />;

  // A Pattern Maker sees only their own uploads (their whole view of the
  // system); an Admin/Staff sees every pattern in the business so they can
  // review what contractors submitted before assigning it.
  const isPatternMaker = role === "PATTERN_MAKER";
  const patterns = await patternService.list(businessId, {
    onlyCreatedById: isPatternMaker ? userId : undefined,
  });

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Styles</h1>
        <p className="text-stone-500 text-sm mt-1">
          {isPatternMaker
            ? "Upload a pattern, then give its Pattern ID to your administrator."
            : `${patterns.length} pattern${patterns.length === 1 ? "" : "s"} · assign one to an order item from the Production page`}
        </p>
      </div>

      <div className="mb-8">
        <PatternUploadForm />
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-ink">
            {isPatternMaker ? "My Patterns" : "All Patterns"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left w-20">Picture</th>
                <th className="th text-left w-32">Pattern ID</th>
                <th className="th text-left">Description</th>
                <th className="th text-left">Files</th>
                {!isPatternMaker && <th className="th text-left">Uploaded By</th>}
                <th className="th text-left">Date</th>
                <th className="th text-center w-20">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {patterns.length === 0 && (
                <tr>
                  <td colSpan={isPatternMaker ? 6 : 7} className="td text-center text-stone-400 py-10">
                    No patterns uploaded yet.
                  </td>
                </tr>
              )}
              {patterns.map((p) => (
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
                  <td className="td">
                    <code className="font-mono text-sm font-semibold text-ink tracking-wide">{p.patternCode}</code>
                  </td>
                  <td className="td text-sm">{p.description}</td>
                  <td className="td">
                    <div className="flex flex-col gap-0.5">
                      {[
                        { url: p.file1Url, name: p.file1Name },
                        { url: p.file2Url, name: p.file2Name },
                        { url: p.file3Url, name: p.file3Name },
                      ].map((f, i) => (
                        <a
                          key={i} href={f.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-amber-600 hover:underline truncate max-w-[180px]"
                        >
                          <FileDown size={11} className="flex-none" /> {f.name}
                        </a>
                      ))}
                    </div>
                  </td>
                  {!isPatternMaker && (
                    <td className="td text-xs text-stone-500">{p.createdBy.name ?? p.createdBy.email}</td>
                  )}
                  <td className="td text-xs text-stone-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  <td className="td text-center">
                    {p._count.items > 0 ? (
                      <span className="badge-completed">{p._count.items}</span>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
