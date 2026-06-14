import { describe, it, expect } from 'vitest';
import {
  renderPoster,
  buildStatRows,
  formatGdp,
  formatMoney,
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
