import { describe, it, expect } from 'vitest';
import {
  loadDesigns,
  saveDesign,
  deleteDesign,
  isStorageAvailable,
  newDesignId,
  type StorageLike,
} from '../src/state/storage';
import { defaultCustomization } from '../src/render/theme';
import type { SavedDesign } from '../src/data/types';

function memStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceeded');
    },
    removeItem: () => {},
  };
}

function design(id: string, query = 'JP'): SavedDesign {
  return {
    id,
    name: `Design ${id}`,
    query,
    customization: defaultCustomization(),
    sizeId: 'desktop',
    savedAt: 1_000,
  };
}

describe('saved designs persistence (SPEC §8.5)', () => {
  it('saves a design and reloads it intact (the "reopen across visits" path)', () => {
    const storage = memStorage();
    const d = design('a', 'France');
    const res = saveDesign(d, storage);
    expect(res.ok).toBe(true);

    // Simulate a page reload: fresh read from the same storage.
    const reloaded = loadDesigns(storage);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].query).toBe('France');
    expect(reloaded[0].customization).toEqual(d.customization);
  });

  it('newest design is first and re-saving the same id updates in place', () => {
    const storage = memStorage();
    saveDesign(design('a'), storage);
    saveDesign(design('b'), storage);
    saveDesign({ ...design('a'), name: 'renamed' }, storage);
    const list = loadDesigns(storage);
    expect(list.map((d) => d.id)).toEqual(['a', 'b']);
    expect(list[0].name).toBe('renamed');
  });

  it('deletes a design', () => {
    const storage = memStorage();
    saveDesign(design('a'), storage);
    saveDesign(design('b'), storage);
    const after = deleteDesign('a', storage);
    expect(after.map((d) => d.id)).toEqual(['b']);
    expect(loadDesigns(storage).map((d) => d.id)).toEqual(['b']);
  });

  it('degrades gracefully when storage is unavailable', () => {
    expect(isStorageAvailable(null)).toBe(false);
    expect(loadDesigns(null)).toEqual([]);
    const res = saveDesign(design('a'), null);
    expect(res.ok).toBe(false);
  });

  it('reports an error when storage is full instead of throwing', () => {
    const res = saveDesign(design('a'), throwingStorage());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/full/i);
  });

  it('generates unique design ids', () => {
    expect(newDesignId()).not.toBe(newDesignId());
  });
});
