// Live FX rates via open.er-api.com (free, no key, CORS-friendly).
// In-memory cache keyed by `${base}->${target}` for 1 hour.

type CacheEntry = { rate: number; ts: number };
const CACHE: Record<string, CacheEntry> = {};
const TTL_MS = 60 * 60 * 1000;

// Strip our internal numeric suffixes (e.g. EUR2 → EUR) for the API call.
const normalize = (code: string): string => code.replace(/\d+$/, "");

export async function fetchRate(
  baseCode: string,
  targetCode: string,
): Promise<number> {
  const base = normalize(baseCode);
  const target = normalize(targetCode);
  if (base === target) return 1;

  const key = `${base}->${target}`;
  const cached = CACHE[key];
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.rate;
  }

  const url = `https://open.er-api.com/v6/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
  const data: { result?: string; rates?: Record<string, number> } = await res.json();
  if (data.result !== "success" || !data.rates) {
    throw new Error("FX response invalid");
  }
  const rate = data.rates[target];
  if (typeof rate !== "number") {
    throw new Error(`FX rate missing for ${target}`);
  }
  CACHE[key] = { rate, ts: Date.now() };
  return rate;
}
