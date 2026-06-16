import { describe, it, expect } from 'vitest';
import { buildMapUrlAt } from '../src/services/geoapifyService';

// Pure URL builder — deterministic, no network (CRITICAL-RULES #3).
describe('geoapify buildMapUrlAt (explicit user zoom)', () => {
  it('emits center as lonlat (lng first), the verbatim zoom, size, key, and English labels', () => {
    const url = buildMapUrlAt(60, 10, 5, 452, 275, 'KEY123');
    expect(decodeURIComponent(url)).toContain('center=lonlat:10,60'); // lng,lat order
    expect(url).toContain('zoom=5');
    expect(url).toContain('width=452');
    expect(url).toContain('height=275');
    expect(url).toContain('apiKey=KEY123');
    expect(url).toContain('lang=en'); // English labels, not the local language
    expect(url).toContain('style=osm-bright'); // vector style that honours `lang`
    expect(url).not.toContain('area=rect');
  });

  it('passes the user-chosen zoom through unchanged (no auto-fitting)', () => {
    expect(buildMapUrlAt(0, 0, 2, 400, 300, 'K')).toContain('zoom=2');
    expect(buildMapUrlAt(0, 0, 9, 400, 300, 'K')).toContain('zoom=9');
  });
});
