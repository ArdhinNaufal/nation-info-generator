// Geoapify Static Maps — a PNG map centered on the country (specs/poster-mode.md §4).
// The center is the REST Countries centroid and the zoom is the user's manual setting (a Map-zoom
// slider in Poster Mode), captured at Generate. `buildMapUrlAt` is a pure URL builder (the
// fetch/decode happens via render/export#loadImage), so it is unit-testable without a network call.

const BASE = 'https://maps.geoapify.com/v1/staticmap';

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
