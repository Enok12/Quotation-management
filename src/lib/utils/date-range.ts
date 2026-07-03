// Turns "from"/"to" query params (YYYY-MM-DD) into a Prisma date filter that
// covers the full day range, inclusive on both ends.
export function dateRangeFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const gte = from ? new Date(`${from}T00:00:00.000`) : undefined;
  const lte = to ? new Date(`${to}T23:59:59.999`) : undefined;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

// Builds a query string from a set of params, omitting any that are empty.
export function buildQuery(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  return usp.toString();
}
