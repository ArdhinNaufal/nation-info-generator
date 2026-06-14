// Poster Mode settings: enter / clear the three API keys (specs/poster-mode.md §5).
// Shows which keys are present (masked) vs missing; persists to localStorage via keyStore.

import { useState } from 'react';
import { getKeys, setKeys, clearKeys, maskKey, type PosterKeys } from '../state/keyStore';

interface Props {
  onClose: () => void;
  onSaved: (keys: PosterKeys) => void;
}

const FIELDS: Array<{ name: keyof PosterKeys; label: string; help: string }> = [
  { name: 'unsplash', label: 'Unsplash Access Key', help: 'Background landmark photo.' },
  { name: 'geoapify', label: 'Geoapify API Key', help: 'Country map snapshot.' },
];

export default function KeySettings({ onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<PosterKeys>(() => getKeys());
  const saved = getKeys();

  const save = () => {
    setKeys(draft);
    onSaved(draft);
    onClose();
  };

  const clearAll = () => {
    clearKeys();
    const empty: PosterKeys = { unsplash: '', geoapify: '' };
    setDraft(empty);
    onSaved(empty);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal panel">
        <div className="preview-meta">
          <h2>Poster API keys</h2>
          <button type="button" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>
        <p className="notice">
          Keys are stored only in this browser (localStorage). World Bank GDP needs no key.
        </p>
        {FIELDS.map((f) => (
          <div key={f.name} style={{ marginBottom: 12 }}>
            <label htmlFor={`key-${f.name}`}>
              {f.label} —{' '}
              {saved[f.name] ? (
                <span style={{ color: 'var(--accent)' }}>set ({maskKey(saved[f.name])})</span>
              ) : (
                <span style={{ color: 'var(--danger)' }}>missing</span>
              )}
            </label>
            <input
              id={`key-${f.name}`}
              type="password"
              autoComplete="off"
              placeholder={f.help}
              value={draft[f.name]}
              onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
            />
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="primary" onClick={save}>
            Save keys
          </button>
          <button type="button" onClick={clearAll}>
            Clear all keys
          </button>
        </div>
      </div>
    </div>
  );
}
