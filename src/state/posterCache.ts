// Per-country poster cache (specs/poster-mode.md §6). On country resolve we check the cache
// first; a hit skips all network steps and renders immediately. Storage is injected so tests
// use an in-memory fake (offline — CRITICAL-RULES #3).

import type { StorageLike } from './storage';

export interface PosterCache {
  alpha2: string;
  landmarkName: string;
  landmarkDescription: string;
  unsplashQuery: string;
  facts: string[];
  photographerName: string;
  photographerUrl: string;
  unsplashPhotoUrl: string; // urls.regular ('' when degraded to no photo)
  geoapifyUrl: string; // full static map URL ('' when unavailable)
  gdp: number | null;
  gdpPerCapitaPpp: number | null;
  generatedAt: number; // Date.now()
}

const keyFor = (alpha2: string): string => `poster_cache_${alpha2.toUpperCase()}`;

function defaultStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__nig_cache_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function getPosterCache(
  alpha2: string,
  storage: StorageLike | null = defaultStorage(),
): PosterCache | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(keyFor(alpha2));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PosterCache;
    return parsed && parsed.alpha2 ? parsed : null;
  } catch {
    return null;
  }
}

export function setPosterCache(
  record: PosterCache,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(keyFor(record.alpha2), JSON.stringify(record));
  } catch {
    /* ignore — storage full / unavailable; rendering still works from memory */
  }
}

export function clearPosterCache(
  alpha2: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(keyFor(alpha2));
  } catch {
    /* ignore */
  }
}
