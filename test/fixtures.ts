// Shared test helper: load + normalize the offline fixture set (no network).
import raw from './fixtures/countries.json';
import { normalizeCountry, type RawCountry } from '../src/data/countries';
import type { Country } from '../src/data/types';

export function loadFixtureCountries(): Country[] {
  return (raw as RawCountry[]).map(normalizeCountry);
}

export function byCca2(countries: Country[], cca2: string): Country {
  const c = countries.find((x) => x.cca2 === cca2);
  if (!c) throw new Error(`fixture missing ${cca2}`);
  return c;
}
