import { describe, it, expect } from 'vitest';
import {
  zoomForArea,
  zoomForBbox,
  buildMapUrl,
  buildMapUrlFromBbox,
  type BBox,
} from '../src/services/geoapifyService';

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

describe('geoapify zoomForBbox (fit the container)', () => {
  const norway: BBox = { lon1: 4.5, lat1: 57.9, lon2: 31.1, lat2: 71.2 };

  it('picks a zoom that fits an elongated country into a landscape-ish slot', () => {
    const z = zoomForBbox(norway, 452, 275);
    expect(z).toBeGreaterThanOrEqual(2);
    expect(z).toBeLessThanOrEqual(4);
  });

  it('zooms in further for a smaller box in the same container', () => {
    const small: BBox = { lon1: 10, lat1: 47, lon2: 12, lat2: 48 }; // ~1/13th the span
    expect(zoomForBbox(small, 452, 275)).toBeGreaterThan(zoomForBbox(norway, 452, 275));
  });

  it('zooms out for a smaller container (fewer pixels to fit the same box)', () => {
    expect(zoomForBbox(norway, 226, 138)).toBeLessThanOrEqual(zoomForBbox(norway, 452, 275));
  });

  it('is constrained by the tighter (Mercator latitude) axis here, not longitude', () => {
    // The latitude fit is the binding one for tall Norway, so a taller container raises the zoom.
    expect(zoomForBbox(norway, 452, 550)).toBeGreaterThanOrEqual(zoomForBbox(norway, 452, 275));
  });
});

describe('geoapify buildMapUrlFromBbox (center+zoom fitted to the container)', () => {
  const norway: BBox = { lon1: 4.5, lat1: 57.9, lon2: 31.1, lat2: 71.2 };

  it('centers on the bbox and uses the container-fitted zoom (no area=rect)', () => {
    const url = buildMapUrlFromBbox(norway, 452, 275, 'KEY123');
    expect(url).toContain('width=452');
    expect(url).toContain('height=275');
    expect(url).toContain('apiKey=KEY123');
    expect(url).toContain(`zoom=${zoomForBbox(norway, 452, 275)}`);
    expect(url).not.toContain('area=rect');
    // Center longitude is the midpoint of the bbox: (4.5 + 31.1) / 2 = 17.8.
    expect(decodeURIComponent(url)).toContain('center=lonlat:17.8,');
  });
});
