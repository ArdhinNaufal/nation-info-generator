// Geoapify Static Maps — a PNG map centered on the country (specs/poster-mode.md §4).
// The zoom is chosen by the user (a Map-zoom slider in Poster Mode) and captured at Generate;
// `buildMapUrlAt` is a pure URL builder (the fetch/decode happens via render/export#loadImage),
// so it is unit-testable without a network call. `fetchCountryBbox` is network-only.

const BASE = 'https://maps.geoapify.com/v1/staticmap';
const GEOCODE = 'https://api.geoapify.com/v1/geocode/search';

/** A geographic bounding box: south-west (lon1,lat1) to north-east (lon2,lat2). */
export interface BBox {
  lon1: number;
  lat1: number;
  lon2: number;
  lat2: number;
}

/**
 * Look up a country's bounding box via Geoapify geocoding (reuses the same key as the static
 * map). Returns null on any failure so the caller can fall back to the REST Countries centroid.
 * We use the bbox only to *center* the map on the whole territory (better than the centroid for
 * elongated nations); the zoom is the user's manual setting.
 */
export async function fetchCountryBbox(query: string, apiKey: string): Promise<BBox | null> {
  const url = `${GEOCODE}?text=${encodeURIComponent(query)}&type=country&format=json&limit=1&apiKey=${encodeURIComponent(
    apiKey,
  )}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Array<{ bbox?: Partial<BBox> }> };
  const b = data.results?.[0]?.bbox;
  if (
    !b ||
    typeof b.lon1 !== 'number' ||
    typeof b.lat1 !== 'number' ||
    typeof b.lon2 !== 'number' ||
    typeof b.lat2 !== 'number'
  ) {
    return null;
  }
  return { lon1: b.lon1, lat1: b.lat1, lon2: b.lon2, lat2: b.lat2 };
}

const clampLat = (lat: number): number => Math.max(-85, Math.min(85, lat));
// Web Mercator y in [0,1] (0 = north edge, 1 = south edge).
const mercY = (lat: number): number => {
  const r = (clampLat(lat) * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / (2 * Math.PI);
};

/** Geometric center of a bbox — longitude midpoint and the *Mercator* latitude midpoint. */
export function bboxCenter(bbox: BBox): { lat: number; lng: number } {
  const lng = (bbox.lon1 + bbox.lon2) / 2;
  const midY = (mercY(bbox.lat1) + mercY(bbox.lat2)) / 2;
  const lat = (Math.atan(Math.sinh((0.5 - midY) * 2 * Math.PI)) * 180) / Math.PI;
  return { lat, lng };
}

/** Static map centered on (lat,lng) at an explicit, user-chosen zoom. Pure — unit-testable. */
export function buildMapUrlAt(
  lat: number,
  lng: number,
  zoom: number,
  mapWidth: number,
  mapHeight: number,
  apiKey: string,
): string {
  const params = new URLSearchParams({
    style: 'osm-carto',
    width: String(Math.round(mapWidth)),
    height: String(Math.round(mapHeight)),
    center: `lonlat:${lng},${lat}`,
    zoom: String(zoom),
    apiKey,
  });
  return `${BASE}?${params.toString()}`;
}
