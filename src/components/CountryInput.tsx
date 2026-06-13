import { useState } from 'react';
import type { Country } from '../data/types';
import { resolveCountry, type ResolveResult } from '../data/countries';

interface Props {
  countries: Country[];
  onResolved: (country: Country) => void;
}

export default function CountryInput({ countries, onResolved }: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ResolveResult | null>(null);

  const submit = (raw: string) => {
    setQuery(raw);
    const r = resolveCountry(raw, countries);
    setResult(r);
    if (r.kind === 'ok') onResolved(r.country);
  };

  return (
    <div className="panel">
      <h2>Country</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <label htmlFor="country">Name, ISO alpha-2 or alpha-3</label>
        <div className="row">
          <input
            id="country"
            type="text"
            placeholder="e.g. Japan, JP, or JPN"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="primary" style={{ flex: '0 0 auto' }}>
            Load
          </button>
        </div>
      </form>

      {result?.kind === 'none' && (
        <>
          <p className="error">
            Couldn't find a country matching "{result.query}". Check the spelling or code.
          </p>
          {result.suggestions.length > 0 && (
            <>
              <p className="notice">Did you mean:</p>
              <ul className="suggestions">
                {result.suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => submit(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {result?.kind === 'ambiguous' && (
        <>
          <p className="notice">Multiple matches — pick one:</p>
          <ul className="matches">
            {result.matches.map((c) => (
              <li key={c.cca2}>
                <button
                  type="button"
                  onClick={() => {
                    setResult({ kind: 'ok', country: c });
                    onResolved(c);
                  }}
                >
                  {c.nameCommon} ({c.cca2})
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
