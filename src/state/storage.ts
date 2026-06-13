// Saved-design persistence to localStorage. The Storage object is injected so tests can use
// an in-memory fake (offline, deterministic — CRITICAL-RULES #3) and so the app degrades
// gracefully when storage is unavailable/full (SPEC §7).

import type { SavedDesign } from '../data/types';

const KEY = 'nig.savedDesigns.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    // Probe — Safari private mode throws on setItem.
    const probe = '__nig_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function isStorageAvailable(storage: StorageLike | null = defaultStorage()): boolean {
  return storage !== null;
}

export function loadDesigns(storage: StorageLike | null = defaultStorage()): SavedDesign[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedDesign[]) : [];
  } catch {
    return [];
  }
}

export type SaveResult = { ok: true; designs: SavedDesign[] } | { ok: false; error: string };

export function saveDesign(
  design: SavedDesign,
  storage: StorageLike | null = defaultStorage(),
): SaveResult {
  if (!storage) return { ok: false, error: 'Saving is unavailable in this browser.' };
  const existing = loadDesigns(storage).filter((d) => d.id !== design.id);
  const next = [design, ...existing];
  try {
    storage.setItem(KEY, JSON.stringify(next));
    return { ok: true, designs: next };
  } catch {
    return { ok: false, error: 'Could not save — browser storage is full.' };
  }
}

export function deleteDesign(
  id: string,
  storage: StorageLike | null = defaultStorage(),
): SavedDesign[] {
  if (!storage) return [];
  const next = loadDesigns(storage).filter((d) => d.id !== id);
  try {
    storage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore — caller still gets the in-memory list */
  }
  return next;
}

export function newDesignId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
