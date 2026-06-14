// Poster Mode orchestration (specs/poster-mode.md §3, §7, §8). Resolves a country; the poster's
// text (landmark name/description, facts, photo-search query) is typed by the user, while World
// Bank GDP, the Unsplash photo, and the Geoapify map are fetched on Generate. Results are cached
// per country; Generate re-runs from the current form and refreshes the cache.

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
import { mapSlotSize } from '../render/poster';
import { fetchGdp } from '../services/worldbank';
import { fetchPhoto } from '../services/unsplashService';
import { buildMapUrl, buildMapUrlFromBbox, fetchCountryBbox } from '../services/geoapifyService';
import CountryInput from './CountryInput';
import KeySettings from './KeySettings';
import PosterPreview, { type PosterImages } from './PosterPreview';

interface Props {
  api: CountryApi;
}

// The user-editable text content of the poster (everything that used to come from Claude).
interface PosterForm {
  landmarkName: string;
  landmarkDescription: string;
  unsplashQuery: string;
  factsText: string; // one fact per line
}

const EMPTY_FORM: PosterForm = {
  landmarkName: '',
  landmarkDescription: '',
  unsplashQuery: '',
  factsText: '',
};

// Field-based starter facts to pre-fill the textarea (specs/poster-mode.md §8) — the user edits
// these, and they're also the fallback if the user clears the box.
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

const parseFacts = (text: string): string[] =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 7);

export default function PosterMode({ api }: Props) {
  const [country, setCountry] = useState<Country | null>(null);
  const [record, setRecord] = useState<PosterCache | null>(null);
  const [form, setForm] = useState<PosterForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keys, setKeysState] = useState<PosterKeys>(() => getKeys());
  const [sizeId, setSizeId] = useState('mobile'); // portrait best matches the poster (§9)
  const [customSize, setCustomSize] = useState({ width: 1080, height: 1920 });
  const [upperScale, setUpperScale] = useState(0.75); // upper-section text size
  const [factsScale, setFactsScale] = useState(0.7); // fact-card text size

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

  // When a country resolves: a cache hit fills the form + renders immediately; a miss pre-fills
  // the form with starter facts and waits for the user to write content and click Generate.
  useEffect(() => {
    if (!country) {
      setRecord(null);
      setForm(EMPTY_FORM);
      return;
    }
    runIdRef.current++; // invalidate any in-flight generation from a previous country
    const cached = getPosterCache(country.cca2);
    if (cached) {
      setForm({
        landmarkName: cached.landmarkName,
        landmarkDescription: cached.landmarkDescription,
        unsplashQuery: cached.unsplashQuery,
        factsText: cached.facts.join('\n'),
      });
      setRecord(cached);
    } else {
      setForm({
        landmarkName: '',
        landmarkDescription: '',
        unsplashQuery: '',
        factsText: fieldFacts(country).join('\n'),
      });
      setRecord(null);
    }
    setLoading(false);
  }, [country]);

  // Generate: fetch GDP + Unsplash photo + build the map URL, combine with the user's text, and
  // persist. The user's typed content is authoritative; only the photo/map/GDP come from APIs.
  const generate = async (): Promise<void> => {
    if (!country) return;
    const c = country;
    const myRun = ++runIdRef.current;
    const stale = () => runIdRef.current !== myRun;
    setLoading(true);
    const k = keys;
    const size = activeSize ?? { width: 1080, height: 1920 };

    const query = form.unsplashQuery.trim() || `${c.nameCommon} landscape`;
    const facts = parseFacts(form.factsText);

    // World Bank (no key), Unsplash, and the Geoapify country bbox run in parallel. Unsplash
    // retries once with a fallback; the bbox lets the map fit the whole territory exactly.
    const [gdpRes, photo, bbox] = await Promise.all([
      fetchGdp(c.cca2).catch(() => ({ gdp: null, gdpPpp: null })),
      k.unsplash
        ? (async () => {
            try {
              return (
                (await fetchPhoto(query, k.unsplash)) ??
                (await fetchPhoto(`${c.nameCommon} landscape`, k.unsplash))
              );
            } catch {
              return null; // bad key / network → degrade to no photo (§8)
            }
          })()
        : Promise.resolve(null),
      k.geoapify && c.latlng
        ? fetchCountryBbox(c.nameCommon, k.geoapify).catch(() => null)
        : Promise.resolve(null),
    ]);
    if (stale()) return; // a newer country/regenerate superseded this run

    // Geoapify map: prefer the geocoded bbox (exact fit); fall back to centroid+zoom if it's
    // missing. PosterPreview decodes the URL (renderer shows "Map unavailable" if it fails).
    let geoapifyUrl = '';
    if (k.geoapify && c.latlng) {
      // Request the map at the exact slot size so its aspect matches and nothing is cropped.
      const slot = mapSlotSize(size);
      geoapifyUrl = bbox
        ? buildMapUrlFromBbox(bbox, slot.width, slot.height, k.geoapify)
        : buildMapUrl(c.latlng[0], c.latlng[1], c.area, slot.width, slot.height, k.geoapify);
    }

    const next: PosterCache = {
      alpha2: c.cca2,
      landmarkName: form.landmarkName.trim(),
      landmarkDescription: form.landmarkDescription.trim(),
      unsplashQuery: query,
      facts: facts.length ? facts : fieldFacts(c),
      photographerName: photo?.photographerName ?? '',
      photographerUrl: photo?.photographerUrl ?? '',
      unsplashPhotoUrl: photo?.url ?? '',
      geoapifyUrl,
      gdp: gdpRes.gdp,
      gdpPerCapitaPpp: gdpRes.gdpPpp,
      generatedAt: Date.now(),
    };
    clearPosterCache(c.cca2);
    setPosterCache(next);
    setRecord(next);
    setLoading(false);
  };

  // Degradation here means an API the user *did* supply a key for came back empty (photo/map).
  // The text content can't fail — it's typed — so it never triggers the banner.
  const degraded =
    !!record &&
    ((!!keys.unsplash && !record.unsplashPhotoUrl) ||
      (!!keys.geoapify && !!country?.latlng && !record.geoapifyUrl));

  // Which key-backed sections can't run because a key is missing (spec §5 inline guidance).
  const missingKeyLabels = [
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
            upperFontScale: upperScale,
            factsFontScale: factsScale,
          }
        : null,
    [country, record, upperScale, factsScale],
  );

  const setField = (name: keyof PosterForm, value: string) =>
    setForm((prev) => ({ ...prev, [name]: value }));

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
            Write the landmark and facts yourself; the poster adds the photo, map, and GDP. Needs
            Unsplash and Geoapify keys (set them in Settings).
          </p>
        </div>

        <CountryInput api={api} onResolved={setCountry} />

        {country && (
          <div className="panel">
            <h2>Poster content</h2>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="poster-landmark">Landmark name</label>
              <input
                id="poster-landmark"
                type="text"
                placeholder="e.g. Geirangerfjord"
                value={form.landmarkName}
                onChange={(e) => setField('landmarkName', e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="poster-landmark-desc">Landmark description (one sentence)</label>
              <input
                id="poster-landmark-desc"
                type="text"
                placeholder="A UNESCO-listed fjord in western Norway"
                value={form.landmarkDescription}
                onChange={(e) => setField('landmarkDescription', e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="poster-query">Photo search query (Unsplash)</label>
              <input
                id="poster-query"
                type="text"
                placeholder={`${country.nameCommon} landscape`}
                value={form.unsplashQuery}
                onChange={(e) => setField('unsplashQuery', e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="poster-facts">Facts (one per line, up to 7)</label>
              <textarea
                id="poster-facts"
                rows={8}
                value={form.factsText}
                onChange={(e) => setField('factsText', e.target.value)}
              />
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => void generate()}
              disabled={loading || !activeSize}
            >
              {loading ? 'Generating…' : record ? '↻ Generate poster' : 'Generate poster'}
            </button>
          </div>
        )}

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
        </div>

        {country && (
          <div className="panel">
            <h2>Text size</h2>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="poster-upper-scale">
                Upper content — {upperScale.toFixed(2)}×
              </label>
              <input
                id="poster-upper-scale"
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={upperScale}
                onChange={(e) => setUpperScale(Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="poster-facts-scale">Facts content — {factsScale.toFixed(2)}×</label>
              <input
                id="poster-facts-scale"
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={factsScale}
                onChange={(e) => setFactsScale(Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        {!country && (
          <div className="panel">
            <p className="notice">Enter a country to start a poster. Try “Norway”.</p>
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

        {country && activeSize && !loading && !record && (
          <div className="panel">
            <p className="notice">
              Write your landmark and facts on the left, then click <strong>Generate poster</strong>.
            </p>
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
            {degraded && (
              <div className="panel banner-warn">
                <p>
                  Some content is unavailable — check your API keys (
                  <button type="button" className="linklike" onClick={() => setSettingsOpen(true)}>
                    Settings
                  </button>
                  ) or try Generate again.
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
