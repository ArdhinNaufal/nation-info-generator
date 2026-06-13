import { describe, it, expect } from 'vitest';
import { SIZE_PRESETS, validateCustomSize, getSizeById } from '../src/render/sizes';
import { prepareCanvas } from '../src/render/export';

describe('size presets (SPEC §8.4)', () => {
  it('exposes the documented presets with exact dimensions', () => {
    expect(getSizeById('desktop')).toMatchObject({ width: 1920, height: 1080 });
    expect(getSizeById('4k')).toMatchObject({ width: 3840, height: 2160 });
    expect(getSizeById('mobile')).toMatchObject({ width: 1080, height: 1920 });
    expect(getSizeById('square')).toMatchObject({ width: 1080, height: 1080 });
    expect(SIZE_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it('applies a size to a canvas exactly (export dimensions)', () => {
    const canvas = { width: 0, height: 0 };
    const size = getSizeById('mobile')!;
    prepareCanvas(canvas, size);
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
  });
});

describe('custom size validation (SPEC §7, §8.4)', () => {
  it('accepts a valid custom size and reports those exact dimensions', () => {
    const r = validateCustomSize(2560, 1440);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.size.width).toBe(2560);
      expect(r.size.height).toBe(1440);
    }
  });

  it('rejects zero / negative sizes', () => {
    expect(validateCustomSize(0, 100).ok).toBe(false);
    expect(validateCustomSize(100, -5).ok).toBe(false);
  });

  it('rejects absurdly large sizes', () => {
    expect(validateCustomSize(99999, 99999).ok).toBe(false);
  });

  it('rejects non-integer and non-numeric sizes', () => {
    expect(validateCustomSize(100.5, 100).ok).toBe(false);
    expect(validateCustomSize('abc', 100).ok).toBe(false);
  });

  it('error result carries a human-readable message', () => {
    const r = validateCustomSize(0, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});
