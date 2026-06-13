// Fetch + normalize REST Countries v3.1, and resolve any user input (name / alpha-2 /
// alpha-3) to a single country. Resolution is a *pure* function over a country list so it
// can be tested offline against fixtures (CRITICAL-RULES #3). The network lives only in the
// thin fetch helpers at the bottom.

import type { Country, Currency, NativeName } from './types';

const API_BASE = 'https://restcountries.com/v3.1';

// --- Normalization: REST Countries wire shape -> our Country ----------------------------

// The wire shape is loosely typed; we only read the fields in SPEC §5 and tolerate missing
// ones (SPEC §7: omit, never render undefined).
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

// --- Resolution (pure) ------------------------------------------------------------------

export type ResolveResult =
  | { kind: 'ok'; country: Country }
  | { kind: 'ambiguous'; matches: Country[] }
  | { kind: 'none'; query: string; suggestions: string[] };

const norm = (s: string): string => s.trim().toLowerCase();

function allNames(c: Country): string[] {
  return [
    c.nameCommon,
    c.nameOfficial,
    ...c.nativeNames.flatMap((n) => [n.common, n.official]),
  ].filter(Boolean);
}

// Cheap edit-distance for "did you mean" suggestions.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function suggestionsFor(query: string, countries: Country[]): string[] {
  const q = norm(query);
  return countries
    .map((c) => ({
      name: c.nameCommon,
      score: Math.min(...allNames(c).map((n) => levenshtein(q, norm(n)))),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .filter((s) => s.score <= Math.max(3, Math.ceil(q.length / 2)))
    .map((s) => s.name);
}

/**
 * Resolve a free-form query to a country. Order: exact alpha-2, exact alpha-3, exact name
 * (any of common/official/native), then substring name match. Multiple exact/substring hits
 * => ambiguous; none => suggestions (SPEC §7).
 */
export function resolveCountry(rawQuery: string, countries: Country[]): ResolveResult {
  const q = norm(rawQuery);
  if (!q) return { kind: 'none', query: rawQuery, suggestions: [] };

  // Exact code matches are unambiguous by construction.
  if (q.length === 2) {
    const hit = countries.find((c) => c.cca2.toLowerCase() === q);
    if (hit) return { kind: 'ok', country: hit };
  }
  if (q.length === 3) {
    const hit = countries.find((c) => c.cca3.toLowerCase() === q);
    if (hit) return { kind: 'ok', country: hit };
  }

  const exact = countries.filter((c) => allNames(c).some((n) => norm(n) === q));
  if (exact.length === 1) return { kind: 'ok', country: exact[0] };
  if (exact.length > 1) return { kind: 'ambiguous', matches: exact };

  const partial = countries.filter((c) => allNames(c).some((n) => norm(n).includes(q)));
  if (partial.length === 1) return { kind: 'ok', country: partial[0] };
  if (partial.length > 1) return { kind: 'ambiguous', matches: partial };

  return { kind: 'none', query: rawQuery, suggestions: suggestionsFor(rawQuery, countries) };
}

export function resolveBorderNames(country: Country, all: Country[]): string[] {
  const byCca3 = new Map(all.map((c) => [c.cca3, c.nameCommon] as const));
  return country.borders.map((b) => byCca3.get(b) ?? b);
}

// --- Network (thin, untested — see fixtures for the data tests) -------------------------

const memo = new Map<string, Promise<Country[]>>();

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`REST Countries request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Fields query keeps payloads small and stable.
const FIELDS =
  'name,cca2,cca3,capital,population,area,region,subregion,languages,currencies,latlng,borders,flags,maps';

/** Fetch + normalize the full country list (memoized per session). */
export async function fetchAllCountries(): Promise<Country[]> {
  const key = 'all';
  if (!memo.has(key)) {
    const p = fetchJson(`${API_BASE}/all?fields=${FIELDS}`).then((data) =>
      (Array.isArray(data) ? (data as RawCountry[]) : []).map(normalizeCountry),
    );
    memo.set(key, p);
  }
  return memo.get(key)!;
}
