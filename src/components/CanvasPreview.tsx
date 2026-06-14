import { useEffect, useRef, useState } from 'react';
import type { Country, Customization } from '../data/types';
import type { Size } from '../render/sizes';
import { render } from '../render/wallpaper';
import {
  prepareCanvas,
  canvasToPngBlob,
  downloadBlob,
  loadFlagImage,
  sanitizeFilename,
} from '../render/export';

interface Props {
  country: Country;
  borderNames: string[];
  customization: Customization;
  size: Size;
}

export default function CanvasPreview({ country, borderNames, customization, size }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flagCache = useRef<Map<string, HTMLImageElement | undefined>>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Make sure bundled webfonts are ready so canvas measures/draws them correctly.
      if (document.fonts?.ready) await document.fonts.ready;

      let flag: HTMLImageElement | undefined;
      if (customization.fields.flag && country.flagPng) {
        if (flagCache.current.has(country.flagPng)) {
          flag = flagCache.current.get(country.flagPng);
        } else {
          flag = await loadFlagImage(country.flagPng);
          flagCache.current.set(country.flagPng, flag);
        }
      }
      if (cancelled) return;

      prepareCanvas(canvas, size);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      render(ctx, {
        country,
        customization,
        size,
        flagImage: flag,
        borderNames,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [country, borderNames, customization, size]);

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    try {
      const blob = await canvasToPngBlob(canvas);
      downloadBlob(blob, `${sanitizeFilename(country.nameCommon)}_${size.width}x${size.height}.png`);
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
          Preview — {size.width}×{size.height}
        </span>
        <button className="primary" onClick={download} disabled={busy}>
          {busy ? 'Exporting…' : 'Download PNG'}
        </button>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
