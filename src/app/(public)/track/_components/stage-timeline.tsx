import { Layers, Scissors, Factory, ShieldCheck, Package, Truck, Check } from "lucide-react";
import { fmtDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const STAGES = [
  { key: "FABRIC_SELECTION", label: "Fabric Selection", icon: Layers },
  { key: "CUTTING", label: "Cutting", icon: Scissors },
  { key: "PRODUCTION", label: "Production", icon: Factory },
  { key: "QUALITY_CHECK", label: "Quality Check", icon: ShieldCheck },
  { key: "IRON_PACKING", label: "Iron / Packing", icon: Package },
  { key: "DELIVERY", label: "Delivery", icon: Truck },
] as const;

export function StageTimeline({
  currentStatus,
  stageDates,
}: {
  currentStatus: string;
  stageDates: Partial<Record<string, Date | string>>;
}) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <ol className="space-y-0">
      {STAGES.map((stage, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const upcoming = i > currentIndex;
        const Icon = stage.icon;
        const date = stageDates[stage.key];

        return (
          <li key={stage.key} className="flex gap-4">
            {/* Rail: icon + connecting line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 flex-none",
                  done && "bg-emerald-500 border-emerald-500 text-white",
                  active && "bg-amber-400 border-amber-400 text-ink",
                  upcoming && "bg-white border-stone-200 text-stone-300",
                )}
              >
                {done ? <Check size={18} /> : <Icon size={18} />}
              </div>
              {i < STAGES.length - 1 && (
                <div className={cn("w-0.5 flex-1 min-h-8", done ? "bg-emerald-500" : "bg-stone-200")} />
              )}
            </div>

            {/* Label */}
            <div className={cn("pb-8", i === STAGES.length - 1 && "pb-0")}>
              <p className={cn("text-sm font-medium", active ? "text-ink" : done ? "text-ink" : "text-stone-400")}>
                {stage.label}
                {active && <span className="ml-2 text-xs font-semibold text-amber-600 uppercase tracking-wide">In progress</span>}
              </p>
              {date && <p className="text-xs text-stone-400 mt-0.5">{fmtDate(date)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
