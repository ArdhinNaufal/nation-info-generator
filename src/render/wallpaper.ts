// Pure wallpaper renderer. Draws a country's facts onto a 2D context per the chosen
// customization + size. Kept free of DOM/canvas construction so it can be unit-tested with a
// recording fake (SPEC §8.2: assert the drawn text/values, not just "a canvas came back").

import type { Country, Customization, FieldKey } from '../data/types';

// Minimal subset of CanvasRenderingContext2D we rely on. The real context structurally
// satisfies this, and tests provide a recording fake.
export interface TextMetricsLike {
  width: number;
}
export interface RenderTarget {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
  lineWidth: number;
  save(): void;
  restore(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): TextMetricsLike;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  clip(): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

export interface Fact {
  key: FieldKey;
  label: string;
  value: string;
}

const fmtInt = (n: number): string => n.toLocaleString('en-US');

/**
 * Build the ordered list of text facts to render. A fact is included only when its toggle is
 * on AND the underlying value is present (SPEC §7: omit missing fields, never render blanks).
 * `flag` is not a text fact — it is drawn as an image and handled in `render`.
 */
export function buildFacts(
  country: Country,
  fields: Record<FieldKey, boolean>,
  borderNames?: string[],
): Fact[] {
  const facts: Fact[] = [];
  const push = (key: FieldKey, label: string, value: string) => {
    if (fields[key] && value) facts.push({ key, label, value });
  };

  push('capital', 'Capital', country.capital.join(', '));
  push('population', 'Population', country.population ? fmtInt(country.population) : '');
  push('area', 'Area', country.area ? `${fmtInt(country.area)} km²` : '');
  push('region', 'Region', country.region);
  push('subregion', 'Subregion', country.subregion);
  push('nativeNames', 'Native name', country.nativeNames[0]?.common ?? '');
  push('languages', 'Languages', country.languages.join(', '));
  push(
    'currencies',
    country.currencies.length > 1 ? 'Currencies' : 'Currency',
    country.currencies.map((c) => (c.symbol ? `${c.name} (${c.symbol})` : c.name)).join(', '),
  );
  push(
    'latlng',
    'Coordinates',
    country.latlng ? `${country.latlng[0].toFixed(1)}°, ${country.latlng[1].toFixed(1)}°` : '',
  );
  push('borders', 'Borders', (borderNames ?? country.borders).join(', '));
  push('maps', 'Map', country.mapsUrl);

  return facts;
}

export interface RenderInput {
  country: Country;
  customization: Customization;
  size: { width: number; height: number };
  /** Decoded flag image; omitted in tests / when unavailable. */
  flagImage?: CanvasImageSource;
  /** Pre-resolved border country names (falls back to alpha-3 codes). */
  borderNames?: string[];
}

interface Theme {
  bg: string;
  text: string;
  accent: string;
  family: string;
  unit: number; // base sizing unit derived from canvas height
}

function font(t: Theme, sizeUnits: number, weight = 400): string {
  return `${weight} ${Math.round(t.unit * sizeUnits)}px ${t.family}`;
}

// Word-wrap on spaces only (never splits a single token, so values like "125,836,021"
// stay intact and remain assertable in tests).
function wrap(ctx: RenderTarget, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawFlag(
  ctx: RenderTarget,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, h * 0.012);
  ctx.strokeRect(x, y, w, h);
}

// Draw "common name" (big) + official + native; returns the y below the block.
function drawTitle(
  ctx: RenderTarget,
  t: Theme,
  c: Country,
  custom: Customization,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign,
): number {
  const anchorX = align === 'center' ? x + maxWidth / 2 : x;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  ctx.fillStyle = t.text;
  ctx.font = font(t, 7, 700);
  let cursor = y;
  for (const line of wrap(ctx, c.nameCommon, maxWidth)) {
    ctx.fillText(line, anchorX, cursor);
    cursor += t.unit * 8;
  }

  if (c.nameOfficial && c.nameOfficial !== c.nameCommon) {
    ctx.fillStyle = t.accent;
    ctx.font = font(t, 2.6, 500);
    for (const line of wrap(ctx, c.nameOfficial, maxWidth)) {
      ctx.fillText(line, anchorX, cursor);
      cursor += t.unit * 3.4;
    }
  }

  const native = custom.fields.nativeNames ? c.nativeNames[0]?.common : '';
  if (native) {
    ctx.fillStyle = t.text;
    ctx.globalAlpha = 0.7;
    ctx.font = font(t, 2.4, 400);
    ctx.fillText(native, anchorX, cursor);
    ctx.globalAlpha = 1;
    cursor += t.unit * 3.2;
  }
  return cursor;
}

// Draw a single "Label / value" fact block; returns y below it.
function drawFact(
  ctx: RenderTarget,
  t: Theme,
  fact: Fact,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign,
): number {
  const anchorX = align === 'center' ? x + maxWidth / 2 : x;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  ctx.fillStyle = t.accent;
  ctx.font = font(t, 1.7, 600);
  ctx.fillText(fact.label.toUpperCase(), anchorX, y);
  let cursor = y + t.unit * 2.4;

  ctx.fillStyle = t.text;
  ctx.font = font(t, 2.6, 400);
  for (const line of wrap(ctx, fact.value, maxWidth)) {
    ctx.fillText(line, anchorX, cursor);
    cursor += t.unit * 3.2;
  }
  return cursor + t.unit * 1.6;
}

/**
 * Render the wallpaper. Returns the list of facts actually drawn (useful for tests and for
 * the UI to report what was included).
 */
export function render(ctx: RenderTarget, input: RenderInput): Fact[] {
  const { country, customization, size, flagImage, borderNames } = input;
  const t: Theme = {
    bg: customization.colors.background,
    text: customization.colors.text,
    accent: customization.colors.accent,
    family: customization.font.family,
    unit: (size.height / 100) * customization.font.scale,
  };

  // Background.
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, size.width, size.height);

  const facts = buildFacts(country, customization.fields, borderNames);
  const pad = Math.round(size.height * 0.07);
  const showFlag = customization.fields.flag && !!flagImage;

  switch (customization.layoutId) {
    case 'sidebar': {
      const leftW = size.width * 0.38;
      const colX = pad;
      const colMax = leftW - pad * 1.5;
      let y = pad;
      if (showFlag) {
        const fw = colMax;
        const fh = fw * 0.62;
        drawFlag(ctx, flagImage!, colX, y, fw, fh, t.accent);
        y += fh + t.unit * 4;
      }
      drawTitle(ctx, t, country, customization, colX, y, colMax, 'left');

      const rightX = leftW + pad * 0.5;
      const rightMax = size.width - rightX - pad;
      let ry = pad;
      for (const f of facts) ry = drawFact(ctx, t, f, rightX, ry, rightMax, 'left');
      break;
    }
    case 'grid': {
      let y = pad;
      const headerMax = size.width - pad * 2;
      if (showFlag) {
        const fw = size.height * 0.18;
        const fh = fw * 0.62;
        drawFlag(ctx, flagImage!, pad, y, fw, fh, t.accent);
        const titleY = drawTitle(
          ctx, t, country, customization,
          pad + fw + pad * 0.6, y, headerMax - fw - pad * 0.6, 'left',
        );
        y = Math.max(y + fh, titleY) + t.unit * 4;
      } else {
        y = drawTitle(ctx, t, country, customization, pad, y, headerMax, 'left') + t.unit * 4;
      }
      const cols = 2;
      const gap = pad * 0.6;
      const colW = (size.width - pad * 2 - gap * (cols - 1)) / cols;
      const colY = [y, y];
      facts.forEach((f, i) => {
        const col = i % cols;
        const x = pad + col * (colW + gap);
        colY[col] = drawFact(ctx, t, f, x, colY[col], colW, 'left') + t.unit * 1.5;
      });
      break;
    }
    case 'minimal': {
      const max = size.width * 0.7;
      const x = size.width * 0.15;
      let y = size.height * 0.22;
      y = drawTitle(ctx, t, country, customization, x, y, max, 'center') + t.unit * 5;
      // Only the headline facts, centered.
      const headline = facts.filter((f) =>
        ['capital', 'population', 'region'].includes(f.key),
      );
      for (const f of headline) y = drawFact(ctx, t, f, x, y, max, 'center') + t.unit * 1;
      break;
    }
    case 'classic':
    default: {
      let y = pad;
      const max = size.width - pad * 2;
      if (showFlag) {
        const fw = size.height * 0.22;
        const fh = fw * 0.62;
        drawFlag(ctx, flagImage!, pad, y, fw, fh, t.accent);
        y += fh + t.unit * 3;
      }
      y = drawTitle(ctx, t, country, customization, pad, y, max, 'left') + t.unit * 4;
      for (const f of facts) y = drawFact(ctx, t, f, pad, y, max, 'left');
      break;
    }
  }
  return facts;
}
