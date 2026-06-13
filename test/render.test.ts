import { describe, it, expect } from 'vitest';
import { render, buildFacts, type RenderTarget } from '../src/render/wallpaper';
import { defaultCustomization } from '../src/render/theme';
import { LAYOUT_PRESETS } from '../src/render/layouts';
import { loadFixtureCountries, byCca2 } from './fixtures';
import type { Customization } from '../src/data/types';

const countries = loadFixtureCountries();
const japan = byCca2(countries, 'JP');
const bouvet = byCca2(countries, 'BV');

// A recording 2D context: captures every fillText call so we can assert on drawn content,
// not just that a canvas was produced (SPEC §8.2).
function recordingCtx(): RenderTarget & { texts: string[]; rects: number } {
  const state = { texts: [] as string[], rects: 0 };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    font: '16px sans-serif',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    globalAlpha: 1,
    lineWidth: 1,
    save() {},
    restore() {},
    fillRect() {
      state.rects++;
    },
    strokeRect() {},
    fillText(text: string) {
      state.texts.push(text);
    },
    measureText(text: string) {
      // Rough monospace estimate; good enough for wrap logic in tests.
      const px = Number(/(\d+)px/.exec(this.font)?.[1]) || 16;
      return { width: text.length * px * 0.5 };
    },
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() {},
    ...state,
  } as RenderTarget & { texts: string[]; rects: number };
  // Bind the live arrays.
  Object.defineProperty(ctx, 'texts', { get: () => state.texts });
  Object.defineProperty(ctx, 'rects', { get: () => state.rects });
  return ctx;
}

const SIZE = { width: 1920, height: 1080 };

describe('wallpaper render correctness (SPEC §8.2)', () => {
  it('draws the country name and key facts', () => {
    const ctx = recordingCtx();
    render(ctx, { country: japan, customization: defaultCustomization(), size: SIZE });
    const joined = ctx.texts.join('\n');
    expect(joined).toContain('Japan');
    expect(joined).toContain('Tokyo');
    expect(joined).toContain('125,836,021'); // population, formatted
    expect(joined).toContain('Asia'); // region
    expect(joined).toContain('377,930 km²'); // area
    expect(ctx.rects).toBeGreaterThan(0); // background was painted
  });
});

describe('customization changes the output (SPEC §8.3)', () => {
  it('toggling a field off removes it from the render', () => {
    const custom = defaultCustomization();
    custom.fields.capital = false;
    const ctx = recordingCtx();
    render(ctx, { country: japan, customization: custom, size: SIZE });
    expect(ctx.texts.join('\n')).not.toContain('Tokyo');
  });

  it('changing colors changes what fillStyle values are used', () => {
    const seen = new Set<string>();
    const base: Customization = defaultCustomization();
    base.colors = { background: '#000000', text: '#ffffff', accent: '#ff0000' };
    const ctx = recordingCtx();
    const origFill = Object.getOwnPropertyDescriptor(ctx, 'fillStyle');
    Object.defineProperty(ctx, 'fillStyle', {
      set(v: string) {
        seen.add(v);
      },
      get() {
        return '';
      },
      configurable: true,
    });
    render(ctx, { country: japan, customization: base, size: SIZE });
    if (origFill) Object.defineProperty(ctx, 'fillStyle', origFill);
    expect(seen.has('#000000')).toBe(true);
    expect(seen.has('#ffffff')).toBe(true);
    expect(seen.has('#ff0000')).toBe(true);
  });

  it('every layout preset still renders the country name', () => {
    for (const layout of LAYOUT_PRESETS) {
      const custom = defaultCustomization();
      custom.layoutId = layout.id;
      const ctx = recordingCtx();
      render(ctx, { country: japan, customization: custom, size: SIZE });
      expect(ctx.texts.join('\n')).toContain('Japan');
    }
  });

  it('layouts differ: minimal omits non-headline facts that classic includes', () => {
    const classic = defaultCustomization();
    classic.layoutId = 'classic';
    const minimal = defaultCustomization();
    minimal.layoutId = 'minimal';

    const c1 = recordingCtx();
    render(c1, { country: japan, customization: classic, size: SIZE });
    const c2 = recordingCtx();
    render(c2, { country: japan, customization: minimal, size: SIZE });

    expect(c1.texts.join('\n')).toContain('Japanese yen'); // currency shown in classic
    expect(c2.texts.join('\n')).not.toContain('Japanese yen'); // not in minimal headline
  });
});

describe('buildFacts omits missing data (SPEC §7)', () => {
  it('skips fields the country lacks', () => {
    const facts = buildFacts(bouvet, defaultCustomization().fields);
    const keys = facts.map((f) => f.key);
    expect(keys).not.toContain('capital'); // Bouvet has no capital
    expect(keys).not.toContain('languages');
    expect(keys).not.toContain('currencies');
    // It still includes what IS present:
    expect(keys).toContain('region');
    expect(keys).toContain('area');
  });

  it('uses resolved border names when provided', () => {
    const france = byCca2(countries, 'FR');
    const facts = buildFacts(france, defaultCustomization().fields, ['Spain', 'Germany']);
    const borders = facts.find((f) => f.key === 'borders');
    expect(borders?.value).toBe('Spain, Germany');
  });
});
