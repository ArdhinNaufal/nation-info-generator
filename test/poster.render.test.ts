import { describe, it, expect } from 'vitest';
import {
  renderPoster,
  buildStatRows,
  formatGdp,
  formatMoney,
  mapSlotSize,
  type PosterTarget,
  type PosterInput,
} from '../src/render/poster';
import { loadFixtureCountries, byCca2 } from './fixtures';

const countries = loadFixtureCountries();
const japan = byCca2(countries, 'JP');
const bouvet = byCca2(countries, 'BV');

// Recording 2D context: captures fillText so we can assert on drawn content (the poster spec's
// §12.9 acceptance: landmark text drawn, ≤7 facts, GDP formatted, missing GDP draws no row).
// Adds the poster-only methods (translate/rotate/createLinearGradient) over the wallpaper fake.
function recordingCtx(): PosterTarget & { texts: string[] } {
  const texts: string[] = [];
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
    fillRect() {},
    strokeRect() {},
    fillText(text: string) {
      texts.push(text);
    },
    measureText(text: string) {
      const px = Number(/(\d+)px/.exec(ctx.font)?.[1]) || 16;
      return { width: text.length * px * 0.5 };
    },
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() {},
    translate() {},
    rotate() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    texts,
  } as unknown as PosterTarget & { texts: string[] };
  return ctx;
}

// A recording context that also captures the font active at each fillText, so we can assert on
// the rendered font size (the font-scale feature) — not just the drawn string.
function recordingCtxWithFont(): PosterTarget & { entries: Array<{ text: string; font: string }> } {
  const entries: Array<{ text: string; font: string }> = [];
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
    fillRect() {},
    strokeRect() {},
    fillText(text: string) {
      entries.push({ text, font: ctx.font });
    },
    measureText(text: string) {
      const px = Number(/(\d+)px/.exec(ctx.font)?.[1]) || 16;
      return { width: text.length * px * 0.5 };
    },
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() {},
    translate() {},
    rotate() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    entries,
  } as unknown as PosterTarget & { entries: Array<{ text: string; font: string }> };
  return ctx;
}

const pxOf = (font: string): number => Number(/(\d+)px/.exec(font)?.[1]) || 0;

const SIZE = { width: 1080, height: 1920 }; // portrait — best matches the poster (§9)

function baseInput(over: Partial<PosterInput> = {}): PosterInput {
  return {
    country: japan,
    landmarkName: 'Mount Fuji',
    landmarkDescription: "Japan's tallest peak, southwest of Tokyo",
    facts: ['Fact one.', 'Fact two.', 'Fact three.'],
    gdp: 4_900_000_000_000,
    gdpPerCapitaPpp: 45_000,
    ...over,
  };
}

describe('poster render correctness (specs/poster-mode.md §12.9)', () => {
  it('draws the landmark text in the poster', () => {
    const ctx = recordingCtx();
    renderPoster(ctx, baseInput(), SIZE);
    expect(ctx.texts.join('\n')).toContain('Mount Fuji');
  });

  it('draws the country name, region, capital, and language', () => {
    const ctx = recordingCtx();
    renderPoster(ctx, baseInput(), SIZE);
    const joined = ctx.texts.join('\n');
    expect(joined).toContain('Japan');
    expect(joined).toContain('Asia'); // region
    expect(joined).toContain('Tokyo'); // capital
    expect(joined).toContain('Japanese'); // official language
  });

  it('renders at most 7 fact cards even when given more', () => {
    const facts = Array.from({ length: 12 }, (_, i) => `Fact number ${i + 1}.`);
    const ctx = recordingCtx();
    const result = renderPoster(ctx, baseInput({ facts }), SIZE);
    expect(result.factsDrawn).toBeLessThanOrEqual(7);
    expect(result.factsDrawn).toBeGreaterThan(0);
  });
});

describe('text wrapping instead of clipping (no ellipsis when it fits)', () => {
  it('wraps a long landmark label onto a second line instead of truncating its end', () => {
    const ctx = recordingCtx();
    renderPoster(
      ctx,
      baseInput({
        landmarkName: 'Geirangerfjord',
        landmarkDescription: 'a deep blue fjord in the scenic western highlands',
      }),
      SIZE,
    );
    const joined = ctx.texts.join('\n');
    // The final word survives (a single-line truncate would have dropped it behind an ellipsis).
    expect(joined).toContain('highlands');
    expect(joined).not.toContain('…');
  });

  it('clips the landmark to two lines with an ellipsis only past two lines', () => {
    const ctx = recordingCtx();
    renderPoster(
      ctx,
      baseInput({
        landmarkName: 'A landmark',
        landmarkDescription: 'word '.repeat(120).trim(), // far more than two lines worth
        // everything else short → an ellipsis can only come from the landmark
      }),
      SIZE,
    );
    expect(ctx.texts.join('\n')).toContain('…');
  });

  it('wraps a long currency name (Ccy) rather than clipping it', () => {
    const ctx = recordingCtx();
    renderPoster(
      ctx,
      baseInput({
        country: {
          ...japan,
          currencies: [{ code: 'XLC', name: 'Some Very Long Currency Name Dollars', symbol: '$' }],
        },
      }),
      SIZE,
    );
    const joined = ctx.texts.join('\n');
    expect(joined).toContain('Dollars'); // last word present → not clipped
    expect(joined).not.toContain('…');
  });

  it('wraps a long Off. Lang. value rather than clipping it', () => {
    const ctx = recordingCtx();
    renderPoster(
      ctx,
      baseInput({
        country: {
          ...japan,
          languages: ['Language Alpha', 'Language Beta', 'Language Gamma', 'Language Delta'],
        },
      }),
      SIZE,
    );
    const joined = ctx.texts.join('\n');
    expect(joined).toContain('Delta'); // last language present → not clipped
    expect(joined).not.toContain('…');
  });
});

describe('font-size scales (upper vs facts)', () => {
  it('upperFontScale enlarges the country-name font', () => {
    const small = recordingCtxWithFont();
    const large = recordingCtxWithFont();
    renderPoster(small, baseInput({ upperFontScale: 1.0 }), SIZE);
    renderPoster(large, baseInput({ upperFontScale: 1.5 }), SIZE);
    const namePx = (c: typeof small) => pxOf(c.entries.find((e) => e.text === 'Japan')!.font);
    expect(namePx(large)).toBeGreaterThan(namePx(small));
  });

  it('factsFontScale enlarges the fact-card font but leaves the upper section unchanged', () => {
    const small = recordingCtxWithFont();
    const large = recordingCtxWithFont();
    renderPoster(small, baseInput({ facts: ['A single fact.'], factsFontScale: 1.0 }), SIZE);
    renderPoster(large, baseInput({ facts: ['A single fact.'], factsFontScale: 1.5 }), SIZE);
    const factPx = (c: typeof small) =>
      pxOf(c.entries.find((e) => e.text === 'A single fact.')!.font);
    const namePx = (c: typeof small) => pxOf(c.entries.find((e) => e.text === 'Japan')!.font);
    expect(factPx(large)).toBeGreaterThan(factPx(small));
    expect(namePx(large)).toBe(namePx(small)); // facts scale must not touch the upper section
  });
});

describe('map slot sizing (full-territory request)', () => {
  it('returns a positive slot that fits inside the canvas', () => {
    const slot = mapSlotSize(SIZE);
    expect(slot.width).toBeGreaterThan(0);
    expect(slot.height).toBeGreaterThan(0);
    expect(slot.width).toBeLessThan(SIZE.width);
    expect(slot.height).toBeLessThan(SIZE.height);
  });
});

describe('GDP formatting (specs/poster-mode.md §2a)', () => {
  it('formats billions like "$486 billion"', () => {
    expect(formatGdp(486_000_000_000)).toBe('$486 billion');
  });

  it('formats trillions with one decimal', () => {
    expect(formatGdp(4_900_000_000_000)).toBe('$4.9 trillion');
  });

  it('formats GDP per capita as a grouped dollar amount', () => {
    expect(formatMoney(104_460)).toBe('$104,460');
  });

  it('draws the formatted GDP value', () => {
    const ctx = recordingCtx();
    renderPoster(ctx, baseInput({ gdp: 486_000_000_000 }), SIZE);
    expect(ctx.texts.join('\n')).toContain('$486 billion');
  });
});

describe('missing GDP renders no blank row (specs/poster-mode.md §8)', () => {
  it('omits the GDP rows when World Bank data is null', () => {
    const rows = buildStatRows(baseInput({ gdp: null, gdpPerCapitaPpp: null }));
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain('GDP');
    expect(labels).not.toContain('GDP Per Capita, PPP');
    // Stats still present from REST Countries shift up into the slots:
    expect(labels).toContain('Population');
  });

  it('keeps the GDP per capita row when only that value is present', () => {
    const rows = buildStatRows(baseInput({ gdp: null, gdpPerCapitaPpp: 45_000 }));
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain('GDP');
    expect(labels).toContain('GDP Per Capita, PPP');
  });

  it('omits stat rows a small territory lacks (Bouvet: no currency)', () => {
    const rows = buildStatRows({
      country: bouvet,
      landmarkName: '',
      landmarkDescription: '',
      facts: [],
      gdp: null,
      gdpPerCapitaPpp: null,
    });
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain('Ccy');
    expect(labels).not.toContain('GDP');
  });
});
