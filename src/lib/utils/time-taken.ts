// Calendar-day distance (ignoring time-of-day) so an order started earlier
// today reads as "Day 1", not "Day 0".
function calendarDayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function daysElapsed(start: Date | string, end: Date | string): number {
  const diffMs = calendarDayStart(new Date(end)) - calendarDayStart(new Date(start));
  const diffDays = Math.round(diffMs / 86_400_000);
  return Math.max(1, diffDays + 1);
}

// "Day 1".."Day 6" for the first week, then "N week(s)" / "N week(s) M day(s)" beyond it.
export function fmtTimeTaken(days: number): string {
  if (days < 7) return `Day ${days}`;
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  const weekLabel = `${weeks} week${weeks === 1 ? "" : "s"}`;
  return remainder === 0 ? weekLabel : `${weekLabel} ${remainder} day${remainder === 1 ? "" : "s"}`;
}
