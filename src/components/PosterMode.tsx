// Poster Mode orchestration (specs/poster-mode.md §3, §7, §8). Resolves a country, checks the
// per-country cache, otherwise runs the World Bank / Claude / Unsplash / Geoapify pipeline with
// graceful degradation, then renders the poster. Regenerate clears the cache and re-runs.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Country } from '../data/types';
import type { CountryApi } from '../data/countries';
import { getSizeById, validateCustomSize, SIZE_PRESETS, type Size } from '../render/sizes';
import { getKeys, type PosterKeys } from '../state/keyStore';
import {
  getPosterCache,
  setPosterCache,
  clearPosterCache,
  type PosterCache,
} from '../state/posterCache';
import { fetchGdp } from '../services/worldbank';
import { fetchPosterContent } from '../services/claudePoster';
import { fetchPhoto } from '../services/unsplashService';
import { buildMapUrl } from '../services/geoapifyService';
import CountryInput from './CountryInput';
import KeySettings from './KeySettings';
import PosterPreview, { type PosterImages } from './PosterPreview';

interface Props {
  api: CountryApi;
}

// Field-based fallback facts when Claude is unavailable (specs/poster-mode.md §8).
function fieldFacts(c: Country): string[] {
  const f: string[] = [];
  if (c.capital.length) f.push(`The capital is ${c.capital.join(', ')}.`);
  if (c.population) f.push(`The population is approximately ${c.population.toLocaleString('en-US')}.`);
  if (c.region) f.push(`It is located in ${c.region}${c.subregion ? ` (${c.subregion})` : ''}.`);
  if (c.languages.length) f.push(`Official language(s): ${c.languages.join(', ')}.`);
  if (c.currencies.length) f.push(`The currency is ${c.currencies.map((x) => x.name).join(', ')}.`);
  if (c.area) f.push(`The total area is ${c.area.toLocaleString('en-US')} km².`);
  if (c.borders.length) f.push(`It shares land borders with ${c.borders.length} country/countries.`);
  return f.slice(0, 7);
}

export default function PosterMode({ api }: Props) {
  const [country, setCountry] = useState<Country | null>(null);
  const [record, setRecord] = useState<PosterCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keys, setKeysState] = useState<PosterKeys>(() => getKeys());
  const [sizeId, setSizeId] = useState('mobile'); // portrait best matches the poster (§9)
  const [customSize, setCustomSize] = useState({ width: 1080, height: 1920 });

  // Keep the latest keys/size in refs so the country-change effect doesn't re-run on every edit.
  const keysRef = useRef(keys);
  keysRef.current = keys;

  // Monotonic run id: a newer country/regenerate invalidates any in-flight generation so a
  // slow pipeline can't render one country's data under another (guards rapid switching).
  const runIdRef = useRef(0);

  const sizeResult = useMemo(() => {
    if (sizeId === 'custom') return validateCustomSize(customSize.width, customSize.height);
    const preset = getSizeById(sizeId);
    return preset
      ? ({ ok: true, size: preset } as const)
      : ({ ok: false, error: 'Unknown size.' } as const);
  }, [sizeId, customSize]);
  const activeSize: Size | null = sizeResult.ok ? sizeResult.size : null;
  const sizeRef = useRef(activeSize);
  sizeRef.current = activeSize;

  // Run the full generation pipeline for a country and persist the result to the cache.
  const generate = async (c: Country): Promise<void> => {
    const myRun = ++runIdRef.current;
    const stale = () => runIdRef.current !== myRun;
    setLoading(true);
    const k = keysRef.current;
    const size = sizeRef.current ?? { width: 1080, height: 1920 };

    // Steps 2 (World Bank, no key) and 3 (Claude) run in parallel (§3).
    const [gdpRes, content] = await Promise.all([
      fetchGdp(c.cca2).catch(() => ({ gdp: null, gdpPpp: null })),
      k.anthropic
        ? fetchPosterContent(c.nameCommon, c.cca2, k.anthropic).catch(() => null)
        : Promise.resolve(null),
    ]);
    if (stale()) return; // a newer country/regenerate superseded this run

    const landmarkName = content?.landmarkName ?? '';
    const landmarkDescription = content?.landmarkDescription ?? '';
    const facts = content?.facts ?? fieldFacts(c);
    const query = content?.unsplashQuery || `${c.nameCommon} landscape`;

    // Step 4 (Unsplash) depends on the query from step 3 (§3). Retry once with a fallback query.
    let photoUrl = '';
    let photographerName = '';
    let photographerUrl = '';
    if (k.unsplash) {
      try {
        const photo =
          (await fetchPhoto(query, k.unsplash)) ??
          (await fetchPhoto(`${c.nameCommon} landscape`, k.unsplash));
        if (photo) {
          photoUrl = photo.url;
          photographerName = photo.photographerName;
          photographerUrl = photo.photographerUrl;
        }
      } catch {
        /* bad key / network → degrade to no photo (§8) */
      }
    }
    if (stale()) return;

    // Step 5 (Geoapify): build the map URL; PosterPreview decodes it (renderer shows
    // "Map unavailable" if the image fails or no URL was produced).
    let geoapifyUrl = '';
    if (k.geoapify && c.latlng) {
      const mapW = Math.round(size.width * 0.4);
      const mapH = Math.round(size.height * 0.3);
      geoapifyUrl = buildMapUrl(c.latlng[0], c.latlng[1], c.area, mapW, mapH, k.geoapify);
    }

    const next: PosterCache = {
      alpha2: c.cca2,
      landmarkName,
      landmarkDescription,
      unsplashQuery: query,
      facts,
      photographerName,
      photographerUrl,
      unsplashPhotoUrl: photoUrl,
      geoapifyUrl,
      gdp: gdpRes.gdp,
      gdpPerCapitaPpp: gdpRes.gdpPpp,
      generatedAt: Date.now(),
    };
    setPosterCache(next);
    setRecord(next);
    setLoading(false);
  };

  // Auto-generate when a country is resolved: cache hit renders immediately, else run pipeline.
  useEffect(() => {
    if (!country) return;
    const cached = getPosterCache(country.cca2);
    if (cached) {
      runIdRef.current++; // invalidate any in-flight generation from a previous country
      setRecord(cached);
      setLoading(false);
      return;
    }
    setRecord(null);
    void generate(country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const regenerate = () => {
    if (!country) return;
    clearPosterCache(country.cca2);
    setRecord(null);
    void generate(country);
  };

  const degraded =
    !!record && (!record.unsplashPhotoUrl || !record.geoapifyUrl || !record.landmarkName);

  // Which key-backed sections can't run because a key is missing (spec §5 inline guidance).
  const missingKeyLabels = [
    !keys.anthropic && 'Anthropic (landmark + facts)',
    !keys.unsplash && 'Unsplash (background photo)',
    !keys.geoapify && 'Geoapify (map)',
  ].filter(Boolean) as string[];

  // Memoized so PosterPreview's effect doesn't re-decode images on unrelated re-renders
  // (e.g. opening Settings) — depends on the country + the cached record only.
  const images: PosterImages | null = useMemo(
    () =>
      country && record
        ? { flagUrl: country.flagPng, photoUrl: record.unsplashPhotoUrl, mapUrl: record.geoapifyUrl }
        : null,
    [country, record],
  );

  const renderInput = useMemo(
    () =>
      country && record
        ? {
            country,
            landmarkName: record.landmarkName,
            landmarkDescription: record.landmarkDescription,
            facts: record.facts,
            gdp: record.gdp,
            gdpPerCapitaPpp: record.gdpPerCapitaPpp,
            photographerName: record.photographerName || undefined,
          }
        : null,
    [country, record],
  );

  return (
    <div className="layout">
      <div>
        <div className="panel">
          <div className="preview-meta">
            <h2>Poster Mode</h2>
            <button type="button" onClick={() => setSettingsOpen(true)}>
              ⚙ Settings
            </button>
          </div>
          <p className="notice">
            Generates a magazine-style poster: landmark photo, map, AI-written facts. Needs
            Anthropic, Unsplash, and Geoapify keys (set them in Settings).
          </p>
        </div>

        <CountryInput api={api} onResolved={setCountry} />

        <div className="panel">
          <h2>Size</h2>
          <label htmlFor="poster-size">Output size</label>
          <select id="poster-size" value={sizeId} onChange={(e) => setSizeId(e.target.value)}>
            {SIZE_PRESETS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {sizeId === 'custom' && (
            <div className="field-grid-3" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="poster-w">Width</label>
                <input
                  id="poster-w"
                  type="number"
                  value={customSize.width}
                  onChange={(e) => setCustomSize({ ...customSize, width: Number(e.target.value) })}
                />
              </div>
              <div>
                <label htmlFor="poster-h">Height</label>
                <input
                  id="poster-h"
                  type="number"
                  value={customSize.height}
                  onChange={(e) => setCustomSize({ ...customSize, height: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          {!sizeResult.ok && <p className="error">{sizeResult.error}</p>}
          {country && (
            <button type="button" onClick={regenerate} disabled={loading} style={{ marginTop: 12 }}>
              {loading ? 'Generating…' : '↻ Regenerate'}
            </button>
          )}
        </div>
      </div>

      <div>
        {!country && (
          <div className="panel">
            <p className="notice">Enter a country to generate a poster. Try “Norway”.</p>
          </div>
        )}

        {country && missingKeyLabels.length > 0 && (
          <div className="panel banner-warn">
            <p>
              Missing API {missingKeyLabels.length > 1 ? 'keys' : 'key'}:{' '}
              {missingKeyLabels.join(', ')}. Add{' '}
              {missingKeyLabels.length > 1 ? 'them' : 'it'} in{' '}
              <button type="button" className="linklike" onClick={() => setSettingsOpen(true)}>
                Settings
              </button>{' '}
              to enable {missingKeyLabels.length > 1 ? 'those sections' : 'that section'}.
            </p>
          </div>
        )}

        {country && !activeSize && (
          <div className="panel">
            <p className="error">{sizeResult.ok ? null : sizeResult.error}</p>
          </div>
        )}

        {country && activeSize && loading && (
          <div className="preview-wrap">
            <div className="preview-meta">
              <span>Generating poster…</span>
            </div>
            <div
              className="poster-skeleton"
              style={{ aspectRatio: `${activeSize.width} / ${activeSize.height}` }}
            >
              <div className="sk sk-upper" />
              <div className="sk sk-card" />
              <div className="sk sk-card" />
              <div className="sk sk-card" />
            </div>
          </div>
        )}

        {country && activeSize && !loading && record && images && renderInput && (
          <>
            {degraded && missingKeyLabels.length === 0 && (
              <div className="panel banner-warn">
                <p>
                  Some content is unavailable — check your API keys (
                  <button type="button" className="linklike" onClick={() => setSettingsOpen(true)}>
                    Settings
                  </button>
                  ) or try Regenerate.
                </p>
              </div>
            )}
            <PosterPreview
              input={renderInput}
              images={images}
              size={activeSize}
              fileBase={country.nameCommon}
            />
          </>
        )}
      </div>

      {settingsOpen && (
        <KeySettings onClose={() => setSettingsOpen(false)} onSaved={setKeysState} />
      )}
    </div>
  );
}
