// API-key storage for Poster Mode (specs/poster-mode.md §5). Keys live in localStorage under
// fixed names; the Storage object is injected so tests use an in-memory fake (offline,
// deterministic — CRITICAL-RULES #3) and the app degrades when storage is unavailable.

import type { StorageLike } from './storage';

export type PosterKeyName = 'anthropic' | 'unsplash' | 'geoapify';

const STORAGE_KEYS: Record<PosterKeyName, string> = {
  anthropic: 'poster_key_anthropic',
  unsplash: 'poster_key_unsplash',
  geoapify: 'poster_key_geoapify',
};

export interface PosterKeys {
  anthropic: string;
  unsplash: string;
  geoapify: string;
}

function defaultStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__nig_key_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function getKeys(storage: StorageLike | null = defaultStorage()): PosterKeys {
  const read = (name: PosterKeyName): string => {
    try {
      return storage?.getItem(STORAGE_KEYS[name]) ?? '';
    } catch {
      return '';
    }
  };
  return { anthropic: read('anthropic'), unsplash: read('unsplash'), geoapify: read('geoapify') };
}

export function setKeys(keys: PosterKeys, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  (Object.keys(STORAGE_KEYS) as PosterKeyName[]).forEach((name) => {
    try {
      const value = keys[name];
      if (value) storage.setItem(STORAGE_KEYS[name], value);
      else storage.removeItem(STORAGE_KEYS[name]);
    } catch {
      /* ignore — storage full / unavailable */
    }
  });
}

export function clearKeys(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  (Object.keys(STORAGE_KEYS) as PosterKeyName[]).forEach((name) => {
    try {
      storage.removeItem(STORAGE_KEYS[name]);
    } catch {
      /* ignore */
    }
  });
}

/** Mask a key for display: show the last 4 chars, e.g. `••••abcd`. Empty when absent. */
export function maskKey(value: string): string {
  if (!value) return '';
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}
