import type { TrendRegion } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fetchTrendData, type TrendData } from "./serpapi";

// "YYYY-MM" for the current month — the granularity trend data is cached at.
export function currentPeriodKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The shared trend snapshot for a region+month, fetched from SerpApi at most
 * once (then cached and reused across every business). `force` bypasses the
 * cache to refresh mid-month.
 */
export async function getTrendSnapshot(
  region: TrendRegion,
  periodKey = currentPeriodKey(),
  force = false,
): Promise<TrendData> {
  if (!force) {
    const cached = await prisma.trendSnapshot.findUnique({ where: { region_periodKey: { region, periodKey } } });
    if (cached) return cached.data as unknown as TrendData;
  }

  const data = await fetchTrendData(region, periodKey);
  // upsert: race-safe enough for a monthly refresh — last writer wins, and the
  // data is equivalent either way.
  await prisma.trendSnapshot.upsert({
    where: { region_periodKey: { region, periodKey } },
    create: { region, periodKey, data: data as unknown as object },
    update: { data: data as unknown as object },
  });
  return data;
}
