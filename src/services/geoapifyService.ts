// Geoapify Static Maps — a PNG map centered on the country (specs/poster-mode.md §4).
// `buildMapUrl` is a pure URL builder (the fetch/decode happens via render/export#loadImage),
// so the zoom heuristic is unit-testable without a network call.

const BASE = 'https://maps.geoapify.com/v1/staticmap';

/** Zoom from country area (km²) — bigger countries zoom out further (§4). */
export function zoomForArea(area: number): number {
  if (area > 3_000_000) return 3;
  if (area > 500_000) return 4;
  if (area > 50_000) return 5;
  if (area > 5_000) return 6;
  return 7;
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
