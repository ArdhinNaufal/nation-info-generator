import type { Customization, FieldKey } from '../data/types';
import { FIELD_KEYS } from '../data/types';
import {
  THEME_PRESETS,
  FONT_OPTIONS,
  getThemeById,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
} from '../render/theme';
import { LAYOUT_PRESETS } from '../render/layouts';
import { SIZE_PRESETS } from '../render/sizes';

const FIELD_LABELS: Record<FieldKey, string> = {
  flag: 'Flag',
  capital: 'Capital',
  population: 'Population',
  area: 'Area',
  region: 'Region',
  subregion: 'Subregion',
  nativeNames: 'Native name',
  languages: 'Languages',
  currencies: 'Currencies',
  latlng: 'Coordinates',
  borders: 'Borders',
  maps: 'Map link',
};

interface Props {
  customization: Customization;
  onChange: (c: Customization) => void;
  sizeId: string;
  customSize: { width: number; height: number };
  onSizeIdChange: (id: string) => void;
  onCustomSizeChange: (s: { width: number; height: number }) => void;
  sizeError: string | null;
}

export default function Controls({
  customization,
  onChange,
  sizeId,
  customSize,
  onSizeIdChange,
  onCustomSizeChange,
  sizeError,
}: Props) {
  const update = (patch: Partial<Customization>) => onChange({ ...customization, ...patch });

  return (
    <>
      <div className="panel">
        <h2>Layout & size</h2>
        <label htmlFor="layout">Layout preset</label>
        <select
          id="layout"
          value={customization.layoutId}
          onChange={(e) => update({ layoutId: e.target.value })}
        >
          {LAYOUT_PRESETS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label} — {l.description}
            </option>
          ))}
        </select>

        <div className="spacer" />
        <label htmlFor="size">Output size</label>
        <select id="size" value={sizeId} onChange={(e) => onSizeIdChange(e.target.value)}>
          {SIZE_PRESETS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>

        {sizeId === 'custom' && (
          <>
            <div className="spacer" />
            <div className="field-grid-3">
              <div>
                <label htmlFor="cw">Width</label>
                <input
                  id="cw"
                  type="number"
                  value={customSize.width}
                  onChange={(e) =>
                    onCustomSizeChange({ ...customSize, width: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label htmlFor="ch">Height</label>
                <input
                  id="ch"
                  type="number"
                  value={customSize.height}
                  onChange={(e) =>
                    onCustomSizeChange({ ...customSize, height: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            {sizeError && <p className="error">{sizeError}</p>}
          </>
        )}
      </div>

      <div className="panel">
        <h2>Theme & colors</h2>
        <label htmlFor="theme">Theme preset</label>
        <select
          id="theme"
          value={customization.themeId}
          onChange={(e) => {
            const t = getThemeById(e.target.value);
            if (t) update({ themeId: t.id, colors: { ...t.colors } });
          }}
        >
          {THEME_PRESETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <div className="spacer" />
        {(['background', 'text', 'accent'] as const).map((k) => (
          <div className="swatch" key={k} style={{ marginBottom: 8 }}>
            <input
              type="color"
              value={customization.colors[k]}
              onChange={(e) =>
                update({ colors: { ...customization.colors, [k]: e.target.value } })
              }
            />
            <span style={{ textTransform: 'capitalize' }}>{k}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Font</h2>
        <label htmlFor="font">Family</label>
        <select
          id="font"
          value={customization.font.family}
          onChange={(e) => update({ font: { ...customization.font, family: e.target.value } })}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.family}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <label htmlFor="scale">Size scale ({customization.font.scale.toFixed(2)}×)</label>
        <input
          id="scale"
          type="range"
          min={FONT_SCALE_MIN}
          max={FONT_SCALE_MAX}
          step={0.05}
          value={customization.font.scale}
          style={{ width: '100%' }}
          onChange={(e) =>
            update({ font: { ...customization.font, scale: Number(e.target.value) } })
          }
        />
      </div>

      <div className="panel">
        <h2>Fields</h2>
        <div className="fields">
          {FIELD_KEYS.map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={customization.fields[k]}
                onChange={(e) =>
                  update({ fields: { ...customization.fields, [k]: e.target.checked } })
                }
              />
              {FIELD_LABELS[k]}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
