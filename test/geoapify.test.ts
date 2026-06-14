import { describe, it, expect } from 'vitest';
import { zoomForArea, buildMapUrl } from '../src/services/geoapifyService';

// Pure URL builder + zoom heuristic — deterministic, no network (CRITICAL-RULES #3).
describe('geoapify zoom heuristic (full-territory bias)', () => {
  it('zooms out for very large countries', () => {
    expect(zoomForArea(17_098_242)).toBe(2); // Russia
    expect(zoomForArea(9_984_670)).toBe(2); // Canada
  });

  it('fits an elongated mid-size nation like Norway with room to spare (zoom 3)', () => {
    expect(zoomForArea(323_802)).toBe(3); // Norway — the reported case
    expect(zoomForArea(357_114)).toBe(3); // Germany
  });

  it('zooms in for small countries and city-states', () => {
    expect(zoomForArea(103_000)).toBe(4); // Iceland
    expect(zoomForArea(2_586)).toBe(5); // Luxembourg
    expect(zoomForArea(719)).toBe(6); // Singapore
  });

  it('is monotonic — bigger area never zooms in further than a smaller one', () => {
    const areas = [100, 4_000, 40_000, 400_000, 4_000_000];
    const zooms = areas.map(zoomForArea);
    for (let i = 1; i < zooms.length; i += 1) expect(zooms[i]).toBeLessThanOrEqual(zooms[i - 1]);
  });
});

describe('geoapify buildMapUrl', () => {
  it('encodes center, zoom, size, and key', () => {
    const url = buildMapUrl(60.5, 8.5, 323_802, 452, 380, 'KEY123');
    expect(url).toContain('center=lonlat%3A8.5%2C60.5');
    expect(url).toContain('zoom=3');
    expect(url).toContain('width=452');
    expect(url).toContain('height=380');
    expect(url).toContain('apiKey=KEY123');
  });
});
