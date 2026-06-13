// Output size presets + custom-size validation (SPEC §2, §7).

export interface Size {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const SIZE_PRESETS: Size[] = [
  { id: 'desktop', label: 'Desktop (1920×1080)', width: 1920, height: 1080 },
  { id: '4k', label: '4K (3840×2160)', width: 3840, height: 2160 },
  { id: 'mobile', label: 'Mobile (1080×1920)', width: 1080, height: 1920 },
  { id: 'square', label: 'Square (1080×1080)', width: 1080, height: 1080 },
  { id: 'tablet', label: 'Tablet (1536×2048)', width: 1536, height: 2048 },
];

export const MIN_DIMENSION = 64;
export const MAX_DIMENSION = 8000;
export const MAX_PIXELS = 40_000_000; // ~6300² — guards against absurd memory use

export type CustomSizeResult =
  | { ok: true; size: Size }
  | { ok: false; error: string };

export function validateCustomSize(width: unknown, height: unknown): CustomSizeResult {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    return { ok: false, error: 'Width and height must be numbers.' };
  }
  if (!Number.isInteger(w) || !Number.isInteger(h)) {
    return { ok: false, error: 'Width and height must be whole numbers.' };
  }
  if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
    return { ok: false, error: `Minimum size is ${MIN_DIMENSION}×${MIN_DIMENSION}px.` };
  }
  if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
    return { ok: false, error: `Maximum dimension is ${MAX_DIMENSION}px.` };
  }
  if (w * h > MAX_PIXELS) {
    return { ok: false, error: 'That size is too large to render in the browser.' };
  }
  return { ok: true, size: { id: 'custom', label: `Custom (${w}×${h})`, width: w, height: h } };
}

export function getSizeById(id: string): Size | undefined {
  return SIZE_PRESETS.find((s) => s.id === id);
}
