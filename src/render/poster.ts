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
  upperFontScale?: number; // multiplier for upper-section text (default 1)
  factsFontScale?: number; // multiplier for fact-card text (default 1)
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

// Width of the far-left vertical-text strip, in `u` units. Wide enough for two stacked lines.
const VSTRIP_U = 4.2;
// Gap between the vertical-text strip and the content column, in `u` units.
const VGAP_U = 2.2;
// Upper panel's share of the canvas height (the rest goes to the fact cards below). Tuned to
// the default upper-content text scale (~0.75×).
const UPPER_FRACTION = 0.43;

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

// --- geometry ------------------------------------------------------------------------------

interface UpperGeo {
  W: number;
  H: number;
  u: number;
  pad: number;
  upX: number;
  upY: number;
  upW: number;
  upH: number;
  ip: number;
  vStrip: number;
  vGap: number;
  cX: number;
  cY: number;
  cW: number;
  cH: number;
  gap: number;
  leftW: number;
  rightX: number;
  rightW: number;
  mapH: number;
}

// Single source of truth for the upper-section layout, shared by renderPoster and mapSlotSize
// so the requested Geoapify image matches the slot it's drawn into (no aspect-driven cropping).
function upperGeometry(size: { width: number; height: number }): UpperGeo {
  const W = size.width;
  const H = size.height;
  const u = H / 100;
  const pad = Math.round(Math.min(W, H) * 0.045);
  const upX = pad;
  const upY = pad;
  const upW = W - pad * 2;
  const upH = Math.round(H * UPPER_FRACTION) - Math.round(pad * 1.5);
  const ip = Math.round(pad * 0.8);
  const vStrip = Math.round(u * VSTRIP_U);
  const vGap = Math.round(u * VGAP_U);
  const cX = upX + ip + vStrip + vGap;
  const cY = upY + ip;
  const cW = upW - ip * 2 - vStrip - vGap;
  const cH = upH - ip * 2;
  const gap = ip;
  const leftW = cW * 0.4;
  const rightX = cX + leftW + gap;
  const rightW = cW - leftW - gap;
  const mapH = Math.round(cH * 0.42);
  return { W, H, u, pad, upX, upY, upW, upH, ip, vStrip, vGap, cX, cY, cW, cH, gap, leftW, rightX, rightW, mapH };
}

/**
 * Pixel size of the map slot for a given poster size. The map is requested from Geoapify at
 * exactly this size so its aspect matches the slot — the whole fetched territory then shows
 * (the renderer draws it "contained", never cropped).
 */
export function mapSlotSize(size: { width: number; height: number }): {
  width: number;
  height: number;
} {
  const g = upperGeometry(size);
  return { width: Math.round(g.rightW), height: g.mapH };
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

// Wrap, but cap at `maxLines`; if the text overflows, the last kept line gets an ellipsis.
function wrapClamped(
  ctx: RenderTarget,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = wrap(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = truncate(ctx, lines.slice(maxLines - 1).join(' '), maxWidth);
  return kept;
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
  const g = upperGeometry(size);
  const { W, H, u, pad, upX, upY, upW, upH, ip, vStrip, cX, cY, cH, gap, leftW, rightX, rightW, mapH } = g;
  const us = input.upperFontScale ?? 1; // upper-section text scale
  const fs = input.factsFontScale ?? 1; // fact-card text scale

  // ---- Background: landmark photo (cover) or dark gradient fallback (§2c, §8) ----
  if (input.backgroundImage) {
    drawCover(ctx, input.backgroundImage, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; // light scrim for legibility
    ctx.fillRect(0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#20242c');
    grad.addColorStop(1, '#0b0d12');
    ctx.fillStyle = grad as unknown as CanvasGradient;
    ctx.fillRect(0, 0, W, H);
  }

  // ================= UPPER SECTION (~55% height) =================
  panel(ctx, upX, upY, upW, upH);

  // ---- Far-left vertical text: "Landmark — description", rotated 90° CCW (§2a) ----
  // Wraps onto a second line rather than truncating; only past two lines is it clipped.
  if (input.landmarkName) {
    const label = input.landmarkDescription
      ? `${input.landmarkName} — ${input.landmarkDescription}`
      : input.landmarkName;
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(u * 1.4, DISPLAY, 700);
    const avail = upH - ip * 2; // run length along the strip
    const lines = wrapClamped(ctx, label, avail, 2);
    const lineGap = u * 1.7;
    const offset0 = -((lines.length - 1) / 2) * lineGap;
    ctx.save();
    ctx.translate(upX + ip + vStrip / 2, upY + upH - ip);
    ctx.rotate(-Math.PI / 2);
    lines.forEach((ln, i) => ctx.fillText(ln, 0, offset0 + i * lineGap));
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
    ctx.font = font(u * 1.5 * us, DISPLAY, 700);
    ctx.fillText(truncate(ctx, row.label, leftW), cX, ly);
    ly += u * 2.1 * us;
    ctx.font = font(u * 2.3 * us, BODY, 400);
    if (row.label === 'Ccy') {
      // Currency is the last left-column row, so let a long name wrap instead of clipping.
      for (const vl of wrap(ctx, row.value, leftW)) {
        ctx.fillText(vl, cX, ly);
        ly += u * 2.8 * us;
      }
      ly += u * 0.8 * us;
    } else {
      ctx.fillText(truncate(ctx, row.value, leftW), cX, ly);
      ly += u * 3.6 * us;
    }
  }

  // ---- Right sub-column: name, map, mini-facts ----
  // Country name, large bold, top-right.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = WHITE;
  ctx.font = font(u * 5.5 * us, DISPLAY, 700);
  let ry = cY;
  for (const line of wrap(ctx, country.nameCommon, rightW)) {
    ctx.fillText(line, rightX + rightW, ry);
    ry += u * 6 * us;
  }
  ry += u * 1.5 * us;

  // Map snapshot — fills the slot edge-to-edge. The map is requested with an `area=rect:` bbox
  // fit (see services/geoapifyService), so the whole country already sits inside the returned
  // image (which matches the slot aspect); cover-fill therefore fills without cropping territory.
  if (input.mapImage) {
    ctx.fillStyle = 'rgba(20, 20, 20, 1)';
    ctx.fillRect(rightX, ry, rightW, mapH);
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

  // Below the map: Region / Capital (two cells), then Off. Lang. (wraps — it's last, with room).
  const cellW = (rightW - gap) / 2;
  const miniCell = (
    label: string,
    value: string,
    x: number,
    y: number,
    w: number,
    wrapValue = false,
  ): void => {
    if (!value) return;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = WHITE;
    ctx.globalAlpha = 0.75;
    ctx.font = font(u * 1.4 * us, BODY, 400);
    ctx.fillText(`${label}:`, x, y);
    ctx.globalAlpha = 1;
    ctx.font = font(u * 1.9 * us, DISPLAY, 700);
    if (wrapValue) {
      let vy = y + u * 1.9 * us;
      for (const vl of wrap(ctx, value, w)) {
        ctx.fillText(vl, x, vy);
        vy += u * 2.3 * us;
      }
    } else {
      ctx.fillText(truncate(ctx, value, w), x, y + u * 1.9 * us);
    }
  };
  miniCell('Region', country.region, rightX, my, cellW);
  miniCell('Capital', country.capital.join(', '), rightX + cellW + gap, my, cellW);
  my += u * 4.6 * us;
  miniCell('Off. Lang.', country.languages.join(', '), rightX, my, rightW, true);

  // ================= LOWER SECTION (~45% height): prose fact cards (§2b) =================
  const lowerTop = upY + upH + Math.round(pad * 0.6);
  const lowerBottom = H - pad;
  const factX = pad;
  const factW = W - pad * 2;
  const cardPad = Math.round(u * 1.4);
  const lineH = u * 2.5 * fs;

  let fy = lowerTop;
  let factsDrawn = 0;
  const facts = input.facts.slice(0, 7); // max 7 (§2b)
  ctx.textAlign = 'left';
  for (const fact of facts) {
    ctx.font = font(u * 2 * fs, BODY, 400);
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
