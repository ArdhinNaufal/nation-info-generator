// Fetch + normalize REST Countries v3.1, and resolve user input (name / alpha-2 / alpha-3) to
// a country. We deliberately avoid the heavy `/v3.1/all` endpoint — it is frequently
// throttled and its error responses omit CORS headers (browsers then report a misleading
// "CORS policy" failure). Instead we use the lightweight, CORS-enabled per-resource endpoints
// `/alpha` and `/name`.
//
// Resolution is expressed against a `CountryApi` interface (dependency-injected) so the exact
// logic we ship is the logic tested offline against fixtures (CRITICAL-RULES #3) — no live
// calls in tests.

import type { Country, Currency, NativeName } from './types';

// In dev we route through the Vite proxy (see vite.config.ts) to dodge CORS while developing
// on localhost; in production we call the CORS-enabled endpoints directly.
const API_BASE = import.meta.env.DEV ? '/rc' : 'https://api.restcountries.com/v3.1';

// Fields query keeps payloads small and stable.
const FIELDS =
  'name,cca2,cca3,capital,population,area,region,subregion,languages,currencies,latlng,borders,flags,maps';

// --- Normalization: REST Countries wire shape -> our Country ----------------------------

export interface RawCountry {
  name?: {
    common?: string;
    official?: string;
    nativeName?: Record<string, { official?: string; common?: string }>;
  };
  cca2?: string;
  cca3?: string;
  capital?: string[];
  population?: number;
  area?: number;
  region?: string;
  subregion?: string;
  languages?: Record<string, string>;
  currencies?: Record<string, { name?: string; symbol?: string }>;
  latlng?: number[];
  borders?: string[];
  flags?: { png?: string; svg?: string; alt?: string };
  maps?: { googleMaps?: string };
}

export function normalizeCountry(raw: RawCountry): Country {
  const nativeNames: NativeName[] = Object.entries(raw.name?.nativeName ?? {}).map(
    ([lang, v]) => ({
      lang,
      official: v.official ?? '',
      common: v.common ?? '',
    }),
  );

  const currencies: Currency[] = Object.entries(raw.currencies ?? {}).map(([code, v]) => ({
    code,
    name: v.name ?? '',
    symbol: v.symbol ?? '',
  }));

  const latlng =
    Array.isArray(raw.latlng) && raw.latlng.length === 2
      ? ([raw.latlng[0], raw.latlng[1]] as [number, number])
      : null;

  return {
    cca2: (raw.cca2 ?? '').toUpperCase(),
    cca3: (raw.cca3 ?? '').toUpperCase(),
    nameCommon: raw.name?.common ?? '',
    nameOfficial: raw.name?.official ?? '',
    nativeNames,
    capital: raw.capital ?? [],
    population: raw.population ?? 0,
    area: raw.area ?? 0,
    region: raw.region ?? '',
    subregion: raw.subregion ?? '',
    languages: Object.values(raw.languages ?? {}),
    currencies,
    flagPng: raw.flags?.png ?? raw.flags?.svg ?? '',
    flagAlt: raw.flags?.alt ?? '',
    latlng,
    borders: (raw.borders ?? []).map((b) => b.toUpperCase()),
    mapsUrl: raw.maps?.googleMaps ?? '',
  };
}

// --- API surface (dependency-injected; tests pass a fixture-backed fake) -----------------

export interface CountryApi {
  /** Exact alpha-2/alpha-3 lookup (`/alpha/{code}`). Empty when unknown. */
  byAlpha(code: string): Promise<Country[]>;
  /** Name search (`/name/{name}`) — substring match over common/official/native names. */
  byName(name: string): Promise<Country[]>;
  /** Batch alpha-3 lookup (`/alpha?codes=…`), used to turn border codes into names. */
  byCodes(codes: string[]): Promise<Country[]>;
}

function allNames(c: Country): string[] {
  return [
    c.nameCommon,
    c.nameOfficial,
    ...c.nativeNames.flatMap((n) => [n.common, n.official]),
  ].filter(Boolean);
}

// --- Resolution (pure given the api) -----------------------------------------------------

export type ResolveResult =
  | { kind: 'ok'; country: Country }
  | { kind: 'ambiguous'; matches: Country[] }
  | { kind: 'none'; query: string; suggestions: string[] };

/**
 * Resolve a free-form query to a country. A 2–3 letter token is tried as an ISO code first;
 * anything else (or a code miss) falls back to a name search. Multiple hits => ambiguous;
 * none => not found (SPEC §7). Network/API errors propagate to the caller to surface as a
 * retryable error.
 */
export async function resolveCountry(
  rawQuery: string,
  api: CountryApi,
): Promise<ResolveResult> {
  const q = rawQuery.trim();
  if (!q) return { kind: 'none', query: rawQuery, suggestions: [] };

  if (/^[A-Za-z]{2,3}$/.test(q)) {
    const byCode = await api.byAlpha(q);
    if (byCode.length === 1) return { kind: 'ok', country: byCode[0] };
    if (byCode.length > 1) return { kind: 'ambiguous', matches: byCode };
    // not a known code — fall through to name search
  }

  const byName = await api.byName(q);
  if (byName.length === 0) return { kind: 'none', query: rawQuery, suggestions: [] };

  const ql = q.toLowerCase();
  const exact = byName.filter((c) => allNames(c).some((n) => n.toLowerCase() === ql));
  if (exact.length === 1) return { kind: 'ok', country: exact[0] };
  if (byName.length === 1) return { kind: 'ok', country: byName[0] };
  if (exact.length > 1) return { kind: 'ambiguous', matches: exact };
  return { kind: 'ambiguous', matches: byName };
}

/** Resolve a country's border alpha-3 codes to common names (falls back to codes). */
export async function fetchBorderNames(country: Country, api: CountryApi): Promise<string[]> {
  if (country.borders.length === 0) return [];
  try {
    const list = await api.byCodes(country.borders);
    const byCca3 = new Map(list.map((c) => [c.cca3, c.nameCommon] as const));
    return country.borders.map((code) => byCca3.get(code) ?? code);
  } catch {
    return country.borders; // never let a border lookup break rendering
  }
}

// --- Live API implementation ------------------------------------------------------------

const API_KEY = import.meta.env.VITE_RESTCOUNTRIES_API_KEY as string | undefined;

async function fetchArray(url: string): Promise<Country[]> {
  const headers: HeadersInit = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
  const res = await fetch(url, { headers });
  if (res.status === 404) return []; // "no such country" — a normal, non-error outcome
  if (!res.ok) {
    throw new Error(`REST Countries request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (Array.isArray(data) ? (data as RawCountry[]) : []).map(normalizeCountry);
}

export function createCountryApi(base: string = API_BASE): CountryApi {
  const cache = new Map<string, Promise<Country[]>>();
  const get = (url: string): Promise<Country[]> => {
    if (!cache.has(url)) cache.set(url, fetchArray(url).catch((e) => (cache.delete(url), Promise.reject(e))));
    return cache.get(url)!;
  };
  return {
    byAlpha: (code) => get(`${base}/alpha/${encodeURIComponent(code)}?fields=${FIELDS}`),
    byName: (name) => get(`${base}/name/${encodeURIComponent(name)}?fields=${FIELDS}`),
    byCodes: (codes) =>
      codes.length === 0
        ? Promise.resolve([])
        : get(`${base}/alpha?codes=${codes.map((c) => c.toLowerCase()).join(',')}&fields=${FIELDS}`),
  };
}
