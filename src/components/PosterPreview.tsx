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

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const clampZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export default function PosterPreview({ input, images, size, fileBase }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [decoded, setDecoded] = useState<DecodedImages | null>(null);
  const [zoom, setZoom] = useState(1); // preview-only display zoom (does not affect export)

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

  // The canvas display size scales with `zoom`; at zoom 1 it fits the card, above 1 the
  // surrounding container scrolls. The canvas's own pixel resolution (and the export) is
  // unaffected — this is a view-only zoom.
  const canvasStyle = {
    maxWidth: `${zoom * 100}%`,
    maxHeight: `calc((100vh - 280px) * ${zoom})`,
  };

  return (
    <div className="preview-wrap">
      <div className="preview-meta">
        <span>
          Poster — {size.width}×{size.height}
        </span>
        <div className="zoom-controls">
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            −
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            +
          </button>
          <button className="primary" onClick={download} disabled={busy}>
            {busy ? 'Exporting…' : 'Download PNG'}
          </button>
        </div>
      </div>
      <div className="poster-canvas-scroll">
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>
    </div>
  );
}
