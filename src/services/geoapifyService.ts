// Geoapify Static Maps — a PNG map centered on the country (specs/poster-mode.md §4).
// The center is the REST Countries centroid and the zoom is the user's manual setting (a Map-zoom
// slider in Poster Mode), captured at Generate. We use a vector style (`osm-bright`) with
// `lang=en` so labels render in English — the raster `osm-carto` style bakes in local-language
// names and ignores `lang`. `buildMapUrlAt` is a pure URL builder (the fetch/decode happens via
// render/export#loadImage), so it is unit-testable without a network call.

const BASE = 'https://maps.geoapify.com/v1/staticmap';

/** Static map centered on (lat,lng) at an explicit, user-chosen zoom, English labels. Pure. */
export function buildMapUrlAt(
  lat: number,
  lng: number,
  zoom: number,
  mapWidth: number,
  mapHeight: number,
  apiKey: string,
): string {
  const params = new URLSearchParams({
    style: 'osm-bright',
    width: String(Math.round(mapWidth)),
    height: String(Math.round(mapHeight)),
    center: `lonlat:${lng},${lat}`,
    zoom: String(zoom),
    lang: 'en',
    apiKey,
  });
  return `${BASE}?${params.toString()}`;
}
