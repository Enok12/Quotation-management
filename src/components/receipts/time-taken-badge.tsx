import { Check } from "lucide-react";
import { daysElapsed, fmtTimeTaken } from "@/lib/utils/time-taken";

interface Props {
  startDate: Date | string;
  /** Date full payment was reached, or null while still ongoing. Counting
   * freezes at this date instead of continuing to grow with "now". */
  completedAt: Date | string | null;
}

// Shows how long an order has taken (or took) to reach full payment —
// "Day N" for the first week, then "N week(s) [M day(s)]" beyond it.
export function TimeTakenBadge({ startDate, completedAt }: Props) {
  const days = daysElapsed(startDate, completedAt ?? new Date());
  const label = fmtTimeTaken(days);

  return (
    <span
      className={
        completedAt
          ? "badge bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "badge bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
      }
      title={completedAt ? `Completed in ${label}` : `${label} so far`}
    >
      {completedAt && <Check size={11} />}
      {label}
    </span>
  );
}
