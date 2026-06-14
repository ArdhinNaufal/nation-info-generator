// Geoapify Static Maps — a PNG map centered on the country (specs/poster-mode.md §4).
// `buildMapUrl` is a pure URL builder (the fetch/decode happens via render/export#loadImage),
// so the zoom heuristic is unit-testable without a network call.

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
 * map). Returns null on any failure so the caller can fall back to the centroid+zoom heuristic.
 * A real bbox lets the static map fit the whole territory exactly (`area=rect:` in
 * buildMapUrlFromBbox) — REST Countries gives no bbox, which is why the centroid heuristic clips
 * elongated nations.
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

/**
 * Static map fitted to a bounding box (`area=rect:`), padded slightly so the country's edges
 * aren't flush against the frame. Geoapify expands the rect to the image aspect, so the whole
 * territory is always visible. Pure — unit-testable without a network call.
 */
export function buildMapUrlFromBbox(
  bbox: BBox,
  mapWidth: number,
  mapHeight: number,
  apiKey: string,
  pad = 0.06,
): string {
  const dLon = (bbox.lon2 - bbox.lon1) * pad;
  const dLat = (bbox.lat2 - bbox.lat1) * pad;
  const lon1 = bbox.lon1 - dLon;
  const lat1 = bbox.lat1 - dLat;
  const lon2 = bbox.lon2 + dLon;
  const lat2 = bbox.lat2 + dLat;
  const params = new URLSearchParams({
    style: 'osm-carto',
    width: String(Math.round(mapWidth)),
    height: String(Math.round(mapHeight)),
    area: `rect:${lon1},${lat1},${lon2},${lat2}`,
    apiKey,
  });
  return `${BASE}?${params.toString()}`;
}

/**
 * Zoom from country area (km²) — bigger countries zoom out further (§4). REST Countries gives
 * no bounding box, so we can't fit the exact territory; the table is biased one step wider than
 * a tight fit so elongated nations (e.g. Norway) sit fully in frame, with neighbours visible.
 * The map is requested at the render slot's size (see render/poster#mapSlotSize) so this stays
 * calibrated to the on-poster pixel width.
 */
export function zoomForArea(area: number): number {
  if (area > 2_500_000) return 2;
  if (area > 250_000) return 3;
  if (area > 25_000) return 4;
  if (area > 1_000) return 5;
  return 6;
}

export function buildMapUrl(
  lat: number,
  lng: number,
  area: number,
  mapWidth: number,
  mapHeight: number,
  apiKey: string,
): string {
  const params = new URLSearchParams({
    style: 'osm-carto',
    width: String(Math.round(mapWidth)),
    height: String(Math.round(mapHeight)),
    center: `lonlat:${lng},${lat}`,
    zoom: String(zoomForArea(area)),
    apiKey,
  });
  return `${BASE}?${params.toString()}`;
}
