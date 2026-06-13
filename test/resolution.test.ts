import { describe, it, expect } from 'vitest';
import { resolveCountry, normalizeCountry } from '../src/data/countries';
import { loadFixtureCountries } from './fixtures';

const countries = loadFixtureCountries();

describe('country resolution (SPEC §8.1)', () => {
  it('resolves common name, alpha-2 and alpha-3 to the same country with identical facts', () => {
    const byName = resolveCountry('Japan', countries);
    const byAlpha2 = resolveCountry('JP', countries);
    const byAlpha3 = resolveCountry('JPN', countries);

    expect(byName.kind).toBe('ok');
    expect(byAlpha2.kind).toBe('ok');
    expect(byAlpha3.kind).toBe('ok');
    if (byName.kind !== 'ok' || byAlpha2.kind !== 'ok' || byAlpha3.kind !== 'ok') return;

    expect(byName.country.cca2).toBe('JP');
    // All three must be the very same normalized object's data.
    expect(byAlpha2.country).toEqual(byName.country);
    expect(byAlpha3.country).toEqual(byName.country);
    expect(byName.country.capital).toEqual(['Tokyo']);
    expect(byName.country.population).toBe(125836021);
  });

  it('is case-insensitive for codes and names', () => {
    expect(resolveCountry('jp', countries).kind).toBe('ok');
    expect(resolveCountry('france', countries).kind).toBe('ok');
  });

  it('resolves an exact name even when it is a substring of others', () => {
    const r = resolveCountry('South Korea', countries);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.country.cca2).toBe('KR');
  });

  it('returns ambiguous matches for a name that matches several countries', () => {
    const r = resolveCountry('Korea', countries);
    expect(r.kind).toBe('ambiguous');
    if (r.kind === 'ambiguous') {
      const codes = r.matches.map((c) => c.cca2).sort();
      expect(codes).toEqual(['KP', 'KR']);
    }
  });

  it('returns none + suggestions for unresolved input (Atlantis) and never a country', () => {
    const r = resolveCountry('Atlantis', countries);
    expect(r.kind).toBe('none');
    if (r.kind === 'none') {
      expect(Array.isArray(r.suggestions)).toBe(true);
    }
  });

  it('returns none for empty input', () => {
    expect(resolveCountry('   ', countries).kind).toBe('none');
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
