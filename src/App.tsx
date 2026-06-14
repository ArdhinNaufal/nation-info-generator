import { useEffect, useMemo, useState } from 'react';
import type { Country, Customization, SavedDesign } from './data/types';
import { createCountryApi, fetchBorderNames } from './data/countries';
import { defaultCustomization } from './render/theme';
import { getSizeById, validateCustomSize, type Size } from './render/sizes';
import {
  loadDesigns,
  saveDesign,
  deleteDesign,
  isStorageAvailable,
  newDesignId,
} from './state/storage';
import CountryInput from './components/CountryInput';
import Controls from './components/Controls';
import CanvasPreview from './components/CanvasPreview';
import SavedDesigns from './components/SavedDesigns';

export default function App() {
  const api = useMemo(() => createCountryApi(), []);
  const [country, setCountry] = useState<Country | null>(null);
  const [borderNames, setBorderNames] = useState<string[]>([]);
  const [customization, setCustomization] = useState<Customization>(defaultCustomization());
  const [sizeId, setSizeId] = useState('desktop');
  const [customSize, setCustomSize] = useState({ width: 2560, height: 1440 });
  const [designs, setDesigns] = useState<SavedDesign[]>([]);

  const storageAvailable = useMemo(() => isStorageAvailable(), []);

  useEffect(() => setDesigns(loadDesigns()), []);

  // When a country is chosen, resolve its border codes to names (best-effort, never blocks).
  const selectCountry = (c: Country) => {
    setCountry(c);
    setBorderNames(c.borders); // show codes immediately
    void fetchBorderNames(c, api).then((names) => setBorderNames(names));
  };

  // Resolve the active size, validating custom dimensions (SPEC §7).
  const sizeResult = useMemo(() => {
    if (sizeId === 'custom') return validateCustomSize(customSize.width, customSize.height);
    const preset = getSizeById(sizeId);
    return preset
      ? ({ ok: true, size: preset } as const)
      : ({ ok: false, error: 'Unknown size.' } as const);
  }, [sizeId, customSize]);

  const activeSize: Size | null = sizeResult.ok ? sizeResult.size : null;
  const sizeError = sizeResult.ok ? null : sizeResult.error;

  const handleSave = () => {
    if (!country) return;
    const name = window.prompt('Name this design:', `${country.nameCommon} wallpaper`);
    if (name === null) return;
    const design: SavedDesign = {
      id: newDesignId(),
      name: name.trim() || `${country.nameCommon} wallpaper`,
      query: country.cca2,
      customization,
      sizeId,
      customSize: sizeId === 'custom' ? customSize : undefined,
      savedAt: Date.now(),
    };
    const res = saveDesign(design);
    if (res.ok) setDesigns(res.designs);
    else alert(res.error);
  };

  const handleOpen = (d: SavedDesign) => {
    setCustomization(d.customization);
    setSizeId(d.sizeId);
    if (d.customSize) setCustomSize(d.customSize);
    void api
      .byAlpha(d.query)
      .then((list) => {
        if (list[0]) selectCountry(list[0]);
      })
      .catch(() => {
        /* leave the previous preview in place if the lookup fails */
      });
  };

  const handleDelete = (id: string) => setDesigns(deleteDesign(id));

  return (
    <div className="app">
      <header>
        <h1>Nation Info Generator</h1>
        <p>
          Make a downloadable wallpaper of any country's facts. Fully client-side. Data from{' '}
          <a href="https://restcountries.com" target="_blank" rel="noreferrer">
            REST Countries
          </a>
          .
        </p>
      </header>

      <div className="layout">
        <div>
          <CountryInput api={api} onResolved={selectCountry} />
          <Controls
            customization={customization}
            onChange={setCustomization}
            sizeId={sizeId}
            customSize={customSize}
            onSizeIdChange={setSizeId}
            onCustomSizeChange={setCustomSize}
            sizeError={sizeError}
          />
          <SavedDesigns
            designs={designs}
            storageAvailable={storageAvailable}
            canSave={!!country}
            onSave={handleSave}
            onOpen={handleOpen}
            onDelete={handleDelete}
          />
        </div>

        <div>
          {!country && (
            <div className="panel">
              <p className="notice">
                Enter a country to generate a wallpaper. Try “Japan”, “JP”, or “JPN”.
              </p>
            </div>
          )}
          {country && !activeSize && (
            <div className="panel">
              <p className="error">{sizeError}</p>
            </div>
          )}
          {country && activeSize && (
            <CanvasPreview
              country={country}
              borderNames={borderNames}
              customization={customization}
              size={activeSize}
            />
          )}
        </div>
      </div>
    </div>
  );
}
