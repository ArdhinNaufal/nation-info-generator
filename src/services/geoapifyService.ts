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
 * A real bbox lets us compute the zoom that fits the whole territory into the map container
 * (`zoomForBbox` in buildMapUrlFromBbox) — REST Countries gives no bbox, which is why the
 * area-only heuristic clips elongated nations.
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

const TILE = 256; // Web Mercator tile size in px
const clampLat = (lat: number): number => Math.max(-85, Math.min(85, lat));
// Web Mercator y in [0,1] (0 = north edge, 1 = south edge).
const mercY = (lat: number): number => {
  const r = (clampLat(lat) * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / (2 * Math.PI);
};

/**
 * The integer zoom at which a bounding box fits inside a `mapWidth × mapHeight` container — the
 * smaller of the longitude-fit and (Mercator) latitude-fit zooms, so the whole box is visible
 * with `pad` (fractional) margin. This is what makes the map fit a country once it cover-fills
 * its slot: the zoom is derived from the actual container, not a coarse area table.
 */
export function zoomForBbox(bbox: BBox, mapWidth: number, mapHeight: number, pad = 0.1): number {
  const f = 1 + pad;
  const lonFrac = (Math.max(0.0001, Math.abs(bbox.lon2 - bbox.lon1)) / 360) * f;
  const latFrac = Math.max(0.0001, Math.abs(mercY(bbox.lat2) - mercY(bbox.lat1))) * f;
  const zoomLon = Math.log2(mapWidth / (TILE * lonFrac));
  const zoomLat = Math.log2(mapHeight / (TILE * latFrac));
  const z = Math.floor(Math.min(zoomLon, zoomLat));
  return Math.max(1, Math.min(18, z));
}

/**
 * Static map centered on a bounding box, zoomed (via `zoomForBbox`) so the whole territory fits
 * the `mapWidth × mapHeight` container. The image is the container size, so the renderer's
 * cover-fill fills the slot edge-to-edge without cropping the country. Pure — unit-testable.
 */
export function buildMapUrlFromBbox(
  bbox: BBox,
  mapWidth: number,
  mapHeight: number,
  apiKey: string,
  pad = 0.1,
): string {
  const lonCenter = (bbox.lon1 + bbox.lon2) / 2;
  // Latitude center taken at the Mercator midpoint (more accurate than a plain average).
  const midY = (mercY(bbox.lat1) + mercY(bbox.lat2)) / 2;
  const latCenter = (Math.atan(Math.sinh((0.5 - midY) * 2 * Math.PI)) * 180) / Math.PI;
  const params = new URLSearchParams({
    style: 'osm-carto',
    width: String(Math.round(mapWidth)),
    height: String(Math.round(mapHeight)),
    center: `lonlat:${lonCenter},${latCenter}`,
    zoom: String(zoomForBbox(bbox, mapWidth, mapHeight, pad)),
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
