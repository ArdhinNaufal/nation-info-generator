// Fetch + normalize REST Countries v5, and resolve user input (name / alpha-2 / alpha-3) to
// a country. All queries go through a single `?q=` search endpoint; alpha-code lookups are
// filtered client-side (v5 has no dedicated code endpoint). Resolution is expressed against a
// `CountryApi` interface (dependency-injected) so the exact logic we ship is the logic tested
// offline against fixtures (CRITICAL-RULES #3) — no live calls in tests.

import type { Country, Currency, NativeName } from './types';

// In dev we route through the Vite proxy (see vite.config.ts) to dodge CORS while developing
// on localhost; in production we call the CORS-enabled endpoints directly.
const API_BASE = import.meta.env.DEV ? '/rc' : 'https://api.restcountries.com/countries/v5';

const API_KEY = import.meta.env.VITE_RESTCOUNTRIES_API_KEY as string | undefined;

// --- Normalization: REST Countries v5 wire shape -> our Country ----------------------------

export interface RawCountry {
  names?: {
    common?: string;
    official?: string;
    native?: Record<string, { official?: string; common?: string }>;
  };
  codes?: {
    alpha_2?: string;
    alpha_3?: string;
  };
  capitals?: Array<{ name?: string }>;
  flag?: { url_png?: string; description?: string };
  region?: string;
  subregion?: string;
  area?: { kilometers?: number };
  borders?: string[];
  coordinates?: { lat?: number; lng?: number };
  currencies?: Array<{ code?: string; name?: string; symbol?: string }>;
  languages?: Array<{ name?: string }>;
  links?: { google_maps?: string };
  population?: number;
}

export function normalizeCountry(raw: RawCountry): Country {
  const nativeNames: NativeName[] = Object.entries(raw.names?.native ?? {}).map(
    ([lang, v]) => ({
      lang,
      official: v.official ?? '',
      common: v.common ?? '',
    }),
  );

  const currencies: Currency[] = (raw.currencies ?? []).map((c) => ({
    code: c.code ?? '',
    name: c.name ?? '',
    symbol: c.symbol ?? '',
  }));

  const latlng =
    raw.coordinates != null
      ? ([raw.coordinates.lat ?? 0, raw.coordinates.lng ?? 0] as [number, number])
      : null;

  return {
    cca2: (raw.codes?.alpha_2 ?? '').toUpperCase(),
    cca3: (raw.codes?.alpha_3 ?? '').toUpperCase(),
    nameCommon: raw.names?.common ?? '',
    nameOfficial: raw.names?.official ?? '',
    nativeNames,
    capital: (raw.capitals ?? []).map((c) => c.name ?? '').filter(Boolean),
    population: raw.population ?? 0,
    area: raw.area?.kilometers ?? 0,
    region: raw.region ?? '',
    subregion: raw.subregion ?? '',
    languages: (raw.languages ?? []).map((l) => l.name ?? '').filter(Boolean),
    currencies,
    flagPng: raw.flag?.url_png ?? '',
    flagAlt: raw.flag?.description ?? '',
    latlng,
    borders: (raw.borders ?? []).map((b) => b.toUpperCase()),
    mapsUrl: raw.links?.google_maps ?? '',
  };
}

// --- API surface (dependency-injected; tests pass a fixture-backed fake) -----------------

export interface CountryApi {
  /** Exact alpha-2/alpha-3 lookup — filters search results client-side. Empty when unknown. */
  byAlpha(code: string): Promise<Country[]>;
  /** Name search (`?q={name}`) — substring match over common/official/native names. */
  byName(name: string): Promise<Country[]>;
  /** Batch alpha code lookup, used to turn border codes into names. */
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

// v5 wraps results in { data: { objects: [...] } }. No-match returns 200 + empty objects[].
async function fetchArray(url: string): Promise<Country[]> {
  const headers: HeadersInit = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`REST Countries request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return ((data?.data?.objects ?? []) as RawCountry[]).map(normalizeCountry);
}

export function createCountryApi(base: string = API_BASE): CountryApi {
  const cache = new Map<string, Promise<Country[]>>();
  const get = (url: string): Promise<Country[]> => {
    if (!cache.has(url)) cache.set(url, fetchArray(url).catch((e) => (cache.delete(url), Promise.reject(e))));
    return cache.get(url)!;
  };

  // v5 has no dedicated code endpoint — search and filter for an exact alpha_2/alpha_3 match.
  const byAlphaImpl = async (code: string): Promise<Country[]> => {
    const results = await get(`${base}?q=${encodeURIComponent(code)}&limit=100`);
    const cu = code.toUpperCase();
    return results.filter((c) => c.cca2 === cu || c.cca3 === cu);
  };

  return {
    byAlpha: byAlphaImpl,
    byName: (name) => get(`${base}?q=${encodeURIComponent(name)}&limit=100`),
    byCodes: async (codes) => {
      if (codes.length === 0) return [];
      const lists = await Promise.all(codes.map(byAlphaImpl));
      return lists.flat();
    },
  };
}
