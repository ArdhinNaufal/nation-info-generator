// Canvas/PNG export helpers. `prepareCanvas` is pure (testable); the blob/download/image
// helpers are browser-only and exercised in manual verification (SPEC §8.4).

export interface SizedCanvas {
  width: number;
  height: number;
}

/** Set a canvas to exactly the chosen output dimensions. */
export function prepareCanvas(canvas: SizedCanvas, size: { width: number; height: number }): void {
  canvas.width = size.width;
  canvas.height = size.height;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export PNG.'));
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Load the flag image for canvas drawing. Resolves to `undefined` (rather than rejecting) on
 * failure so a missing/blocked flag never breaks wallpaper generation (SPEC §7).
 */
export function loadFlagImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    if (!url) return resolve(undefined);
    const img = new Image();
    img.crossOrigin = 'anonymous'; // flagcdn allows CORS; needed for an untainted canvas
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'wallpaper';
}
