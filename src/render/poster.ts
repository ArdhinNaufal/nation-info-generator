// Pure poster renderer (specs/poster-mode.md §10). Draws a magazine-style country poster
// onto a 2D context: landmark-photo background, flag + stats, map snapshot, prose fact cards.
// Like render/wallpaper.ts it is kept free of DOM/canvas construction so it is unit-testable
// with a recording fake ctx (assert drawn text/values, not "a canvas came back").

import type { Country } from '../data/types';
import type { RenderTarget } from './wallpaper';

// Poster needs a little more of the 2D API than the wallpaper (rotation for the vertical
// landmark text, a gradient for the no-photo fallback). The real CanvasRenderingContext2D
// structurally satisfies this; tests provide a recording fake.
export interface GradientLike {
  addColorStop(offset: number, color: string): void;
}
export interface PosterTarget extends RenderTarget {
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): GradientLike;
}

export interface PosterInput {
  country: Country;
  landmarkName: string;
  landmarkDescription: string;
  facts: string[];
  gdp: number | null;
  gdpPerCapitaPpp: number | null;
  flagImage?: CanvasImageSource; // REST Countries flag (drawn in the left sub-column)
  backgroundImage?: CanvasImageSource; // Unsplash photo
  mapImage?: CanvasImageSource; // Geoapify PNG
  photographerName?: string;
  borderNames?: string[];
}

export interface StatRow {
  label: string;
  value: string;
}

export interface PosterRenderResult {
  stats: StatRow[];
  factsDrawn: number;
}

const WHITE = '#ffffff';
const PANEL = 'rgba(0, 0, 0, 0.45)';
const DISPLAY = '"Montserrat", system-ui, sans-serif';
const BODY = '"Inter", system-ui, sans-serif';

const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');

/** GDP as `$X.X trillion` (≥1e12) or `$X billion` (≥1e9), per the reference (`$486 billion`). */
export function formatGdp(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)} trillion`;
  if (n >= 1e9) return `$${Math.round(n / 1e9)} billion`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)} million`;
  return `$${fmtInt(n)}`;
}

/** A plain dollar amount, locale-grouped: `$104,460`. */
export function formatMoney(n: number): string {
  return `$${fmtInt(n)}`;
}

/**
 * Build the left-column stat rows in spec order. A row is included only when its value is
 * present — a null World Bank GDP (or a territory with no area/currency) yields no blank row,
 * and the remaining rows shift up (specs/poster-mode.md §8).
 */
export function buildStatRows(input: PosterInput): StatRow[] {
  const { country, gdp, gdpPerCapitaPpp } = input;
  const rows: StatRow[] = [];
  if (gdp != null) rows.push({ label: 'GDP', value: formatGdp(gdp) });
  if (gdpPerCapitaPpp != null) {
    rows.push({ label: 'GDP Per Capita, PPP', value: formatMoney(gdpPerCapitaPpp) });
  }
  if (country.population) rows.push({ label: 'Population', value: fmtInt(country.population) });
  if (country.area) rows.push({ label: 'Area', value: `${fmtInt(country.area)} SQ.KM` });
  const currency = country.currencies[0]?.name;
  if (currency) rows.push({ label: 'Ccy', value: currency });
  return rows;
}

// --- low-level drawing helpers -------------------------------------------------------------

function font(px: number, family: string, weight = 400): string {
  return `${weight} ${Math.round(px)}px ${family}`;
}

// Word-wrap on spaces only (keeps tokens like "5,519,594" intact and assertable).
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

function truncate(ctx: RenderTarget, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function imgDims(img: CanvasImageSource): { w: number; h: number } {
  const a = img as {
    naturalWidth?: number;
    videoWidth?: number;
    width?: number | { baseVal?: number };
    naturalHeight?: number;
    videoHeight?: number;
    height?: number | { baseVal?: number };
  };
  const w = a.naturalWidth || a.videoWidth || (typeof a.width === 'number' ? a.width : 0);
  const h = a.naturalHeight || a.videoHeight || (typeof a.height === 'number' ? a.height : 0);
  return { w, h };
}

function panel(ctx: RenderTarget, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = PANEL;
  ctx.fillRect(x, y, w, h);
}

// Cover-crop an image into a box (clipped; centered; aspect preserved, overflow trimmed).
function drawCover(
  ctx: RenderTarget,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const { w: iw, h: ih } = imgDims(img);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (iw > 0 && ih > 0) {
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

// Contain an image inside a box (aspect preserved, letterboxed, top-anchored). Returns the
// height actually used so the caller can place content below the flag.
function drawContain(
  ctx: RenderTarget,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  maxH: number,
): number {
  const { w: iw, h: ih } = imgDims(img);
  if (iw <= 0 || ih <= 0) {
    ctx.drawImage(img, x, y, w, w * 0.6);
    return w * 0.6;
  }
  const scale = Math.min(w / iw, maxH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x, y, dw, dh);
  return dh;
}

// --- the renderer --------------------------------------------------------------------------

/**
 * Render the poster. Returns the stat rows and the number of fact cards actually drawn, so
 * tests can assert "GDP omitted when null" and "≤ 7 facts" without reading pixels.
 */
export function renderPoster(
  ctx: PosterTarget,
  input: PosterInput,
  size: { width: number; height: number },
): PosterRenderResult {
  const { country } = input;
  const W = size.width;
  const H = size.height;
  const u = H / 100; // base sizing unit

  // ---- Background: landmark photo (cover) or dark gradient fallback (§2c, §8) ----
  if (input.backgroundImage) {
    drawCover(ctx, input.backgroundImage, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; // light scrim for legibility
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#20242c');
    g.addColorStop(1, '#0b0d12');
    ctx.fillStyle = g as unknown as CanvasGradient;
    ctx.fillRect(0, 0, W, H);
  }

  const pad = Math.round(Math.min(W, H) * 0.045);

  // ================= UPPER SECTION (~55% height) =================
  const upX = pad;
  const upY = pad;
  const upW = W - pad * 2;
  const upH = Math.round(H * 0.55) - Math.round(pad * 1.5);
  panel(ctx, upX, upY, upW, upH);

  const ip = Math.round(pad * 0.8);
  const vStrip = Math.round(u * 3.5); // far-left vertical-text strip
  const cX = upX + ip + vStrip;
  const cY = upY + ip;
  const cW = upW - ip * 2 - vStrip;
  const cH = upH - ip * 2;
  const gap = ip;
  const leftW = cW * 0.4;
  const rightX = cX + leftW + gap;
  const rightW = cW - leftW - gap;

  // ---- Far-left vertical text: "Landmark — description", rotated 90° CCW (§2a) ----
  if (input.landmarkName) {
    const label = input.landmarkDescription
      ? `${input.landmarkName} — ${input.landmarkDescription}`
      : input.landmarkName;
    ctx.save();
    ctx.translate(upX + ip * 0.5 + vStrip * 0.4, upY + upH - ip);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(u * 1.5, DISPLAY, 700);
    ctx.fillText(truncate(ctx, label, upH - ip * 2), 0, 0);
    ctx.restore();
  }

  // ---- Left sub-column: flag + stacked stat rows ----
  let ly = cY;
  if (input.flagImage) {
    const used = drawContain(ctx, input.flagImage, cX, ly, leftW, cH * 0.32);
    ly += used + u * 2.5;
  }

  const stats = buildStatRows(input);
  ctx.textAlign = 'left';
  for (const row of stats) {
    if (ly > cY + cH) break;
    ctx.textBaseline = 'top';
    ctx.fillStyle = WHITE;
    ctx.font = font(u * 1.5, DISPLAY, 700);
    ctx.fillText(truncate(ctx, row.label, leftW), cX, ly);
    ly += u * 2.1;
    ctx.font = font(u * 2.3, BODY, 400);
    ctx.fillText(truncate(ctx, row.value, leftW), cX, ly);
    ly += u * 3.6;
  }

  // ---- Right sub-column: name, map, mini-facts ----
  // Country name, large bold, top-right.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = WHITE;
  ctx.font = font(u * 5.5, DISPLAY, 700);
  let ry = cY;
  for (const line of wrap(ctx, country.nameCommon, rightW)) {
    ctx.fillText(line, rightX + rightW, ry);
    ry += u * 6;
  }
  ry += u * 1.5;

  // Map snapshot.
  const mapH = Math.round(cH * 0.42);
  if (ry + mapH > cY + cH) {
    // keep within column
  }
  if (input.mapImage) {
    drawCover(ctx, input.mapImage, rightX, ry, rightW, mapH);
  } else {
    ctx.fillStyle = 'rgba(20, 20, 20, 1)';
    ctx.fillRect(rightX, ry, rightW, mapH);
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(u * 2, BODY, 500);
    ctx.fillText('Map unavailable', rightX + rightW / 2, ry + mapH / 2);
  }
  let my = ry + mapH + u * 2.5;

  // Below the map: Region / Capital (two cells), then Off. Lang.
  const cellW = (rightW - gap) / 2;
  const miniCell = (label: string, value: string, x: number, y: number, w: number): void => {
    if (!value) return;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = WHITE;
    ctx.globalAlpha = 0.75;
    ctx.font = font(u * 1.4, BODY, 400);
    ctx.fillText(`${label}:`, x, y);
    ctx.globalAlpha = 1;
    ctx.font = font(u * 1.9, DISPLAY, 700);
    ctx.fillText(truncate(ctx, value, w), x, y + u * 1.9);
  };
  miniCell('Region', country.region, rightX, my, cellW);
  miniCell('Capital', country.capital.join(', '), rightX + cellW + gap, my, cellW);
  my += u * 4.6;
  miniCell('Off. Lang.', country.languages.join(', '), rightX, my, rightW);

  // ================= LOWER SECTION (~45% height): prose fact cards (§2b) =================
  const lowerTop = upY + upH + Math.round(pad * 0.6);
  const lowerBottom = H - pad;
  const factX = pad;
  const factW = W - pad * 2;
  const cardPad = Math.round(u * 1.4);
  const lineH = u * 2.5;

  let fy = lowerTop;
  let factsDrawn = 0;
  const facts = input.facts.slice(0, 7); // max 7 (§2b)
  ctx.textAlign = 'left';
  for (const fact of facts) {
    ctx.font = font(u * 2, BODY, 400);
    const lines = wrap(ctx, fact, factW - cardPad * 2);
    const cardH = cardPad * 2 + lines.length * lineH;
    if (fy + cardH > lowerBottom) break; // stop when space runs out
    panel(ctx, factX, fy, factW, cardH);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = 'top';
    let ty = fy + cardPad;
    for (const line of lines) {
      ctx.fillText(line, factX + cardPad, ty);
      ty += lineH;
    }
    fy += cardH + u * 1.2;
    factsDrawn += 1;
  }

  // ---- Photographer credit, bottom-right (§2c) ----
  if (input.photographerName) {
    ctx.fillStyle = WHITE;
    ctx.globalAlpha = 0.85;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = font(u * 1.3, BODY, 400);
    ctx.fillText(`Photo by ${input.photographerName} on Unsplash`, W - pad * 0.5, H - pad * 0.3);
    ctx.globalAlpha = 1;
  }

  return { stats, factsDrawn };
}
