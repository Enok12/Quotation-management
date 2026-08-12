import { termsFor, geoFor, type TrendCategory, type TrendTerm } from "@/lib/recommendations/terms";

// Fetches Google-Trends time-series for the curated apparel terms via SerpApi
// and distills each into a compact, LLM-ready summary (recent level + how it's
// moved). This is the ONLY place that talks to SerpApi; results are cached by
// the trend-snapshot service so this runs at most once a month per region.

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

export interface TermTrend {
  term: string;
  category: TrendCategory;
  /** Relative interest (0–100 within its comparison group) averaged over the
   * last ~4 weeks, and over a 4-week window ~3 months earlier. */
  recentAvg: number;
  priorAvg: number;
  /** (recent − prior) / prior, as a rounded percentage. */
  changePercent: number;
  direction: "rising" | "falling" | "flat";
}

export interface TrendData {
  region: "LOCAL" | "GLOBAL";
  periodKey: string;
  fetchedAt: string;
  terms: TermTrend[];
}

interface SerpTimelinePoint {
  values?: { extracted_value?: number }[];
}
interface SerpResponse {
  error?: string;
  interest_over_time?: { timeline_data?: SerpTimelinePoint[] };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

function summarize(term: TrendTerm, series: number[]): TermTrend {
  // Last 4 weeks vs. a 4-week window ~3 months (13 weeks) earlier.
  const recent = series.slice(-4);
  const prior = series.slice(Math.max(0, series.length - 13), Math.max(0, series.length - 9));
  const recentAvg = Math.round(avg(recent));
  const priorAvg = Math.round(avg(prior.length ? prior : series.slice(0, 4)));
  const changePercent = priorAvg > 0 ? Math.round(((recentAvg - priorAvg) / priorAvg) * 100) : 0;
  const direction = changePercent > 10 ? "rising" : changePercent < -10 ? "falling" : "flat";
  return { term: term.term, category: term.category, recentAvg, priorAvg, changePercent, direction };
}

async function fetchGroup(group: TrendTerm[], geo: string, apiKey: string): Promise<TermTrend[]> {
  const params = new URLSearchParams({
    engine: "google_trends",
    q: group.map((t) => t.term).join(","),
    data_type: "TIMESERIES",
    date: "today 12-m",
    api_key: apiKey,
  });
  if (geo) params.set("geo", geo);

  const res = await fetch(`${SERPAPI_ENDPOINT}?${params}`);
  const json = (await res.json()) as SerpResponse;
  if (!res.ok || json.error) throw new Error(`SerpApi: ${json.error ?? res.status}`);

  const timeline = json.interest_over_time?.timeline_data ?? [];
  // values[i] corresponds to group[i], in order.
  return group.map((term, i) => {
    const series = timeline.map((p) => p.values?.[i]?.extracted_value ?? 0);
    return summarize(term, series);
  });
}

/** Pull every curated term's trend for a region. Groups sequentially (≈3 calls). */
export async function fetchTrendData(region: "LOCAL" | "GLOBAL", periodKey: string): Promise<TrendData> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not configured");

  const geo = geoFor(region);
  const terms: TermTrend[] = [];
  for (const group of chunk(termsFor(region), 5)) {
    terms.push(...(await fetchGroup(group, geo, apiKey)));
  }

  return { region, periodKey, fetchedAt: new Date().toISOString(), terms };
}
