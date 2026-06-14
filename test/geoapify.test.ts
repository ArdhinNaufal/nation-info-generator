import { describe, it, expect } from 'vitest';
import { bboxCenter, buildMapUrlAt, type BBox } from '../src/services/geoapifyService';

// Pure helpers — deterministic, no network (CRITICAL-RULES #3). `fetchCountryBbox` hits a live
// API so it is intentionally not unit-tested.
const norway: BBox = { lon1: 4.5, lat1: 57.9, lon2: 31.1, lat2: 71.2 };

describe('geoapify bboxCenter', () => {
  it('uses the longitude midpoint and a Mercator latitude midpoint inside the box', () => {
    const { lat, lng } = bboxCenter(norway);
    expect(lng).toBeCloseTo(17.8, 6); // (4.5 + 31.1) / 2
    expect(lat).toBeGreaterThan(norway.lat1);
    expect(lat).toBeLessThan(norway.lat2);
  });

  it('returns the same latitude for a symmetric box (equator-centered)', () => {
    expect(bboxCenter({ lon1: -10, lat1: -5, lon2: 10, lat2: 5 }).lat).toBeCloseTo(0, 6);
  });
});

describe('geoapify buildMapUrlAt (explicit user zoom)', () => {
  it('emits the exact center, the verbatim zoom, size, and key', () => {
    const url = buildMapUrlAt(64.5, 17.8, 5, 452, 275, 'KEY123');
    expect(decodeURIComponent(url)).toContain('center=lonlat:17.8,64.5');
    expect(url).toContain('zoom=5');
    expect(url).toContain('width=452');
    expect(url).toContain('height=275');
    expect(url).toContain('apiKey=KEY123');
    expect(url).not.toContain('area=rect');
  });

  it('passes the user-chosen zoom through unchanged (no auto-fitting)', () => {
    expect(buildMapUrlAt(0, 0, 2, 400, 300, 'K')).toContain('zoom=2');
    expect(buildMapUrlAt(0, 0, 9, 400, 300, 'K')).toContain('zoom=9');
  });
});
