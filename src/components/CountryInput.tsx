import { useState } from 'react';
import type { Country } from '../data/types';
import { resolveCountry, type CountryApi, type ResolveResult } from '../data/countries';

interface Props {
  api: CountryApi;
  onResolved: (country: Country) => void;
}

export default function CountryInput({ api, onResolved }: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const submit = async (raw: string) => {
    setQuery(raw);
    setLoading(true);
    setNetworkError(null);
    try {
      const r = await resolveCountry(raw, api);
      setResult(r);
      if (r.kind === 'ok') onResolved(r.country);
    } catch {
      setResult(null);
      setNetworkError("Couldn't reach the country data service. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  const pick = (c: Country) => {
    setResult({ kind: 'ok', country: c });
    onResolved(c);
  };

  return (
    <div className="panel">
      <h2>Country</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(query);
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
          <button type="submit" className="primary" style={{ flex: '0 0 auto' }} disabled={loading}>
            {loading ? '…' : 'Load'}
          </button>
        </div>
      </form>

      {networkError && (
        <>
          <p className="error">{networkError}</p>
          <button type="button" onClick={() => void submit(query)}>
            Retry
          </button>
        </>
      )}

      {result?.kind === 'none' && (
        <p className="error">
          Couldn't find a country matching "{result.query}". Check the spelling or try an ISO
          code (e.g. JP, JPN).
        </p>
      )}

      {result?.kind === 'ambiguous' && (
        <>
          <p className="notice">Multiple matches — pick one:</p>
          <ul className="matches">
            {result.matches.map((c) => (
              <li key={c.cca2}>
                <button type="button" onClick={() => pick(c)}>
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
