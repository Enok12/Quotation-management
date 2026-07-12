// Runs `worker` over `items` with at most `limit` in flight at once, plus a
// small stagger between dispatches — used to keep bulk receipt extraction
// well under the Gemini free-tier per-minute rate limit instead of firing
// every request at once. `worker` is responsible for reporting its own
// per-item result (e.g. via a state update) rather than returning one, since
// callers care about live progress, not a final aggregate array.
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  staggerMs: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;

  async function runNext(): Promise<void> {
    const index = next++;
    if (index >= items.length) return;
    if (staggerMs > 0) await new Promise((r) => setTimeout(r, staggerMs));
    await worker(items[index], index);
    await runNext();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
}
