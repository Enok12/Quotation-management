import { Check } from "lucide-react";
import { daysElapsed, fmtTimeTaken } from "@/lib/utils/time-taken";

interface Props {
  /** When the clock starts: the date the order was confirmed by its first
   * payment. Null while nothing has been paid — an order sitting unconfirmed
   * isn't "taking" time yet, so it shows no count at all rather than
   * silently accruing days against work that hasn't been commissioned. */
  startDate: Date | string | null;
  /** Date full payment was reached, or null while still ongoing. Counting
   * freezes at this date instead of continuing to grow with "now". */
  completedAt: Date | string | null;
}

// Shows how long an order has taken (or took) between its first payment and
// being paid in full — "Day N" for the first week, then "N week(s) [M day(s)]".
export function TimeTakenBadge({ startDate, completedAt }: Props) {
  if (!startDate) {
    return (
      <span
        className="badge bg-stone-100 text-stone-500 dark:bg-white/10 dark:text-stone-400"
        title="Counting starts when the first payment is recorded"
      >
        Not started
      </span>
    );
  }

  const days = daysElapsed(startDate, completedAt ?? new Date());
  const label = fmtTimeTaken(days);

  return (
    <span
      className={
        completedAt
          ? "badge bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "badge bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
      }
      title={completedAt ? `Completed in ${label}` : `${label} since first payment`}
    >
      {completedAt && <Check size={11} />}
      {label}
    </span>
  );
}
