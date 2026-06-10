// Live FX rates via open.er-api.com (free, no API key, CORS-friendly).
// 1h in-memory cache, keyed by base currency. Each entry stores the full
// rate table so multi-currency split-view lookups don't refire the network.

type RateMap = Record<string, number>;
type CacheEntry = { rates: RateMap; ts: number };
const CACHE: Record<string, CacheEntry> = {};
const PENDING: Record<string, Promise<RateMap>> = {};
const TTL_MS = 60 * 60 * 1000;

// Strip our internal numeric suffixes (e.g. EUR2 → EUR) for the API call.
const normalize = (code: string): string => code.replace(/\d+$/, "");

export async function fetchRatesForBase(baseCode: string): Promise<RateMap> {
  const base = normalize(baseCode);
  const cached = CACHE[base];
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.rates;
  }
  if (PENDING[base]) return PENDING[base];

  const url = `https://open.er-api.com/v6/latest/${base}`;
  PENDING[base] = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
      const data: { result?: string; rates?: RateMap } = await res.json();
      if (data.result !== "success" || !data.rates) {
        throw new Error("FX response invalid");
      }
      CACHE[base] = { rates: data.rates, ts: Date.now() };
      return data.rates;
    } finally {
      delete PENDING[base];
    }
  })();
  return PENDING[base];
}

export async function fetchRate(
  baseCode: string,
  targetCode: string,
): Promise<number> {
  const base = normalize(baseCode);
  const target = normalize(targetCode);
  if (base === target) return 1;
  const rates = await fetchRatesForBase(base);
  const rate = rates[target];
  if (typeof rate !== "number") {
    throw new Error(`FX rate missing for ${target}`);
  }
  return rate;
}

export function getCachedRate(
  baseCode: string,
  targetCode: string,
): number | null {
  const base = normalize(baseCode);
  const target = normalize(targetCode);
  if (base === target) return 1;
  const entry = CACHE[base];
  if (!entry) return null;
  if (Date.now() - entry.ts >= TTL_MS) return null;
  const r = entry.rates[target];
  return typeof r === "number" ? r : null;
}
