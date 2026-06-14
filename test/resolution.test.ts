import { describe, it, expect } from 'vitest';
import { resolveCountry, fetchBorderNames, normalizeCountry, type CountryApi } from '../src/data/countries';
import type { Country } from '../src/data/types';
import { loadFixtureCountries } from './fixtures';

const countries = loadFixtureCountries();

function names(c: Country): string[] {
  return [
    c.nameCommon,
    c.nameOfficial,
    ...c.nativeNames.flatMap((n) => [n.common, n.official]),
  ].filter(Boolean);
}

// Fixture-backed fake mirroring REST Countries semantics: /alpha is an exact code match,
// /name is a substring match over all names, /alpha?codes is an exact alpha-3 batch. This
// keeps the SHIPPED resolution logic under test, fully offline (CRITICAL-RULES #3).
function fakeApi(list: Country[] = countries): CountryApi {
  return {
    byAlpha: async (code) => {
      const c = code.toLowerCase();
      return list.filter((x) => x.cca2.toLowerCase() === c || x.cca3.toLowerCase() === c);
    },
    byName: async (name) => {
      const q = name.toLowerCase();
      return list.filter((x) => names(x).some((n) => n.toLowerCase().includes(q)));
    },
    byCodes: async (codes) => {
      const set = new Set(codes.map((c) => c.toUpperCase()));
      return list.filter((x) => set.has(x.cca3));
    },
  };
}

const api = fakeApi();

describe('country resolution (SPEC §8.1)', () => {
  it('resolves common name, alpha-2 and alpha-3 to the same country with identical facts', async () => {
    const byName = await resolveCountry('Japan', api);
    const byAlpha2 = await resolveCountry('JP', api);
    const byAlpha3 = await resolveCountry('JPN', api);

    expect(byName.kind).toBe('ok');
    expect(byAlpha2.kind).toBe('ok');
    expect(byAlpha3.kind).toBe('ok');
    if (byName.kind !== 'ok' || byAlpha2.kind !== 'ok' || byAlpha3.kind !== 'ok') return;

    expect(byName.country.cca2).toBe('JP');
    expect(byAlpha2.country).toEqual(byName.country);
    expect(byAlpha3.country).toEqual(byName.country);
    expect(byName.country.capital).toEqual(['Tokyo']);
    expect(byName.country.population).toBe(125836021);
  });

  it('is case-insensitive for codes and names', async () => {
    expect((await resolveCountry('jp', api)).kind).toBe('ok');
    expect((await resolveCountry('france', api)).kind).toBe('ok');
  });

  it('resolves an exact name even when it is a substring of others', async () => {
    const r = await resolveCountry('South Korea', api);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.country.cca2).toBe('KR');
  });

  it('returns ambiguous matches for a name that matches several countries', async () => {
    const r = await resolveCountry('Korea', api);
    expect(r.kind).toBe('ambiguous');
    if (r.kind === 'ambiguous') {
      const codes = r.matches.map((c) => c.cca2).sort();
      expect(codes).toEqual(['KP', 'KR']);
    }
  });

  it('returns none for unresolved input (Atlantis) and never a country', async () => {
    const r = await resolveCountry('Atlantis', api);
    expect(r.kind).toBe('none');
    if (r.kind === 'none') expect(Array.isArray(r.suggestions)).toBe(true);
  });

  it('returns none for empty input', async () => {
    expect((await resolveCountry('   ', api)).kind).toBe('none');
  });

  it('propagates network errors so the UI can offer a retry (SPEC §7)', async () => {
    const failing: CountryApi = {
      byAlpha: async () => {
        throw new Error('network down');
      },
      byName: async () => {
        throw new Error('network down');
      },
      byCodes: async () => [],
    };
    await expect(resolveCountry('France', failing)).rejects.toThrow('network down');
  });
});

describe('border-name resolution', () => {
  it('turns border alpha-3 codes into country names', async () => {
    const france = countries.find((c) => c.cca2 === 'FR')!;
    const subset = france.borders.includes('ESP'); // sanity: fixture has borders
    expect(subset).toBe(true);
    const names = await fetchBorderNames(france, api);
    // Only borders present in the fixture set resolve to names; the rest keep their codes.
    expect(names).toContain('AND'); // Andorra not in fixtures -> code retained
    expect(names.length).toBe(france.borders.length);
  });

  it('returns [] for a country with no borders', async () => {
    const japan = countries.find((c) => c.cca2 === 'JP')!;
    expect(await fetchBorderNames(japan, api)).toEqual([]);
  });
});

describe('normalization tolerates missing fields (SPEC §7)', () => {
  it('omits fields absent from the API response instead of inventing them', () => {
    const bouvet = normalizeCountry({
      name: { common: 'Bouvet Island', official: 'Bouvet Island' },
      cca2: 'BV',
      cca3: 'BVT',
    });
    expect(bouvet.capital).toEqual([]);
    expect(bouvet.languages).toEqual([]);
    expect(bouvet.currencies).toEqual([]);
    expect(bouvet.nativeNames).toEqual([]);
  });
});
