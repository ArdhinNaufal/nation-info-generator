// World Bank API — GDP and GDP-per-capita-PPP for a country (specs/poster-mode.md §4).
// CORS-enabled, no key. A null value (small territories) or any failure yields null for that
// stat so the poster simply omits the row (§8).

const BASE = 'https://api.worldbank.org/v2';
const GDP = 'NY.GDP.MKTP.CD';
const GDP_PPP = 'NY.GDP.PCAP.PP.CD';

export interface GdpResult {
  gdp: number | null;
  gdpPpp: number | null;
}

async function fetchIndicator(alpha2: string, indicator: string): Promise<number | null> {
  const url = `${BASE}/country/${alpha2.toLowerCase()}/indicator/${indicator}?format=json&mrv=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;
  // Shape: [ <metadata>, [ { value: number | null, ... } ] ]
  const value = Array.isArray(data) ? (data[1] as Array<{ value?: unknown }> | undefined)?.[0]?.value : undefined;
  return typeof value === 'number' ? value : null;
}

export async function fetchGdp(alpha2: string): Promise<GdpResult> {
  const [gdp, gdpPpp] = await Promise.all([
    fetchIndicator(alpha2, GDP).catch(() => null),
    fetchIndicator(alpha2, GDP_PPP).catch(() => null),
  ]);
  return { gdp, gdpPpp };
}
