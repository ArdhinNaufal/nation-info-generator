// Unsplash search — one photo for the landmark query (specs/poster-mode.md §4).
// Returns `null` when a (successful) search yields no results so the caller can retry with a
// fallback query; throws on a transport/auth error so the caller can degrade to a solid bg.

const BASE = 'https://api.unsplash.com/search/photos';

export interface UnsplashPhoto {
  url: string; // urls.regular — the canvas image
  photographerName: string;
  photographerUrl: string;
}

interface UnsplashResponse {
  results?: Array<{
    urls?: { regular?: string };
    user?: { name?: string; links?: { html?: string } };
  }>;
}

export async function fetchPhoto(query: string, key: string): Promise<UnsplashPhoto | null> {
  const url = `${BASE}?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) throw new Error(`Unsplash request failed: ${res.status}`);
  const data = (await res.json()) as UnsplashResponse;
  const first = data.results?.[0];
  if (!first?.urls?.regular) return null;
  return {
    url: first.urls.regular,
    photographerName: first.user?.name ?? '',
    photographerUrl: first.user?.links?.html ?? '',
  };
}
