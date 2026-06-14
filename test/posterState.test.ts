import { describe, it, expect } from 'vitest';
import type { StorageLike } from '../src/state/storage';
import { getKeys, setKeys, clearKeys, maskKey, type PosterKeys } from '../src/state/keyStore';
import {
  getPosterCache,
  setPosterCache,
  clearPosterCache,
  type PosterCache,
} from '../src/state/posterCache';

// In-memory StorageLike (offline, deterministic — CRITICAL-RULES #3).
function memStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const keys: PosterKeys = { unsplash: 'unsp-456', geoapify: 'geo-789' };

describe('poster key store (specs/poster-mode.md §5)', () => {
  it('round-trips keys and reports present vs missing', () => {
    const s = memStorage();
    setKeys(keys, s);
    expect(getKeys(s)).toEqual(keys);
  });

  it('clears all keys', () => {
    const s = memStorage();
    setKeys(keys, s);
    clearKeys(s);
    expect(getKeys(s)).toEqual({ unsplash: '', geoapify: '' });
  });

  it('an empty value removes (does not store) that key', () => {
    const s = memStorage();
    setKeys({ ...keys, unsplash: '' }, s);
    expect(getKeys(s).unsplash).toBe('');
    expect(getKeys(s).geoapify).toBe('geo-789');
  });

  it('masks a key to its last 4 chars and never reveals the rest', () => {
    expect(maskKey('sk-ant-abcd')).toBe('••••abcd');
    expect(maskKey('')).toBe('');
    expect(maskKey('xy')).toBe('••••');
  });

  it('degrades to empty keys when storage is unavailable', () => {
    expect(getKeys(null)).toEqual({ unsplash: '', geoapify: '' });
  });
});

function cache(alpha2: string, over: Partial<PosterCache> = {}): PosterCache {
  return {
    alpha2,
    landmarkName: 'Mount Fuji',
    landmarkDescription: 'desc',
    unsplashQuery: 'Mount Fuji',
    facts: ['a', 'b'],
    photographerName: 'Ansel',
    photographerUrl: 'https://unsplash.com/@ansel',
    unsplashPhotoUrl: 'https://images.unsplash.com/x',
    geoapifyUrl: 'https://maps.geoapify.com/x',
    gdp: 4_900_000_000_000,
    gdpPerCapitaPpp: 45_000,
    generatedAt: 1_000,
    ...over,
  };
}

describe('poster cache (specs/poster-mode.md §6)', () => {
  it('stores and reloads a record by alpha-2 (the cache-hit path)', () => {
    const s = memStorage();
    setPosterCache(cache('JP'), s);
    const hit = getPosterCache('JP', s);
    expect(hit?.landmarkName).toBe('Mount Fuji');
    expect(hit?.gdp).toBe(4_900_000_000_000);
  });

  it('is case-insensitive on the alpha-2 key', () => {
    const s = memStorage();
    setPosterCache(cache('JP'), s);
    expect(getPosterCache('jp', s)?.alpha2).toBe('JP');
  });

  it('returns null on a miss and after clear (the Regenerate path)', () => {
    const s = memStorage();
    expect(getPosterCache('FR', s)).toBeNull();
    setPosterCache(cache('FR'), s);
    clearPosterCache('FR', s);
    expect(getPosterCache('FR', s)).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    const s = memStorage();
    s.setItem('poster_cache_DE', '{not json');
    expect(getPosterCache('DE', s)).toBeNull();
  });

  it('degrades to null when storage is unavailable', () => {
    expect(getPosterCache('JP', null)).toBeNull();
  });
});
