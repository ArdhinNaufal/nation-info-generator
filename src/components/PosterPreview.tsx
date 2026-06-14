// Renders a PosterInput onto a canvas and offers a PNG download (specs/poster-mode.md §10).
// Parallel to CanvasPreview but for the poster renderer. Images (flag/photo/map) are decoded
// here (browser-only) and passed into the pure renderPoster.

import { useEffect, useRef, useState } from 'react';
import type { Size } from '../render/sizes';
import { renderPoster, type PosterInput, type PosterTarget } from '../render/poster';
import {
  prepareCanvas,
  canvasToPngBlob,
  downloadBlob,
  loadImage,
  loadFlagImage,
  sanitizeFilename,
} from '../render/export';

export interface PosterImages {
  flagUrl: string;
  photoUrl: string; // '' when degraded to no photo
  mapUrl: string; // '' when unavailable
}

interface Props {
  input: Omit<PosterInput, 'flagImage' | 'backgroundImage' | 'mapImage'>;
  images: PosterImages;
  size: Size;
  fileBase: string;
}

interface DecodedImages {
  flag?: CanvasImageSource;
  photo?: CanvasImageSource;
  map?: CanvasImageSource;
}

export default function PosterPreview({ input, images, size, fileBase }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [decoded, setDecoded] = useState<DecodedImages | null>(null);

  // Decode the images only when the URLs change — not on every text/size/scale tweak, so the
  // sliders redraw instantly without re-fetching the flag/photo/map.
  useEffect(() => {
    let cancelled = false;
    setDecoded(null);
    (async () => {
      const [flag, photo, map] = await Promise.all([
        loadFlagImage(images.flagUrl),
        loadImage(images.photoUrl),
        loadImage(images.mapUrl),
      ]);
      if (!cancelled) setDecoded({ flag, photo, map });
    })();
    return () => {
      cancelled = true;
    };
  }, [images]);

  // Redraw whenever the decoded images, the render input (incl. font scales), or the size change.
  useEffect(() => {
    if (!decoded) return;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (document.fonts?.ready) await document.fonts.ready;
      if (cancelled) return;

      prepareCanvas(canvas, size);
      const ctx = canvas.getContext('2d') as PosterTarget | null;
      if (!ctx) return;
      renderPoster(
        ctx,
        { ...input, flagImage: decoded.flag, backgroundImage: decoded.photo, mapImage: decoded.map },
        size,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [decoded, input, size]);

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const blob = await canvasToPngBlob(canvas);
      downloadBlob(blob, `${sanitizeFilename(fileBase)}_poster_${size.width}x${size.height}.png`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="preview-wrap">
      <div className="preview-meta">
        <span>
          Poster — {size.width}×{size.height}
        </span>
        <button className="primary" onClick={download} disabled={busy}>
          {busy ? 'Exporting…' : 'Download PNG'}
        </button>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
