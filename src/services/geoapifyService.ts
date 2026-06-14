// Geoapify Static Maps — a PNG map centered on the country (specs/poster-mode.md §4).
// `buildMapUrl` is a pure URL builder (the fetch/decode happens via render/export#loadImage),
// so the zoom heuristic is unit-testable without a network call.

const BASE = 'https://maps.geoapify.com/v1/staticmap';

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
