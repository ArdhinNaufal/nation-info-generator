// Domain types. `Country` is our normalized shape — independent of the REST Countries
// wire format (see data/countries.ts for the mapping). Canonical id = ISO alpha-2 (`cca2`).

export interface NativeName {
  lang: string; // ISO 639-3 key as returned by the API (e.g. "jpn")
  official: string;
  common: string;
}

export interface Currency {
  code: string; // e.g. "JPY"
  name: string;
  symbol: string;
}

export interface Country {
  cca2: string; // canonical id, uppercase, e.g. "JP"
  cca3: string; // e.g. "JPN"
  nameCommon: string;
  nameOfficial: string;
  nativeNames: NativeName[];
  capital: string[];
  population: number;
  area: number; // km²
  region: string;
  subregion: string;
  languages: string[];
  currencies: Currency[];
  flagPng: string;
  flagAlt: string;
  latlng: [number, number] | null;
  borders: string[]; // alpha-3 codes
  mapsUrl: string;
}

// Toggleable fact fields (the country name is always shown and is not in this set).
export type FieldKey =
  | 'capital'
  | 'population'
  | 'area'
  | 'region'
  | 'subregion'
  | 'nativeNames'
  | 'languages'
  | 'currencies'
  | 'latlng'
  | 'borders'
  | 'maps'
  | 'flag';

export const FIELD_KEYS: FieldKey[] = [
  'flag',
  'capital',
  'population',
  'area',
  'region',
  'subregion',
  'nativeNames',
  'languages',
  'currencies',
  'latlng',
  'borders',
  'maps',
];

export interface ThemeColors {
  background: string;
  text: string;
  accent: string;
}

export interface FontChoice {
  family: string; // CSS font-family value used by canvas
  scale: number; // multiplier applied to base font sizes (0.7–1.6)
}

export interface Customization {
  themeId: string;
  colors: ThemeColors;
  font: FontChoice;
  fields: Record<FieldKey, boolean>;
  layoutId: string;
}

export interface SavedDesign {
  id: string;
  name: string;
  query: string; // the resolved country query (alpha-2)
  customization: Customization;
  sizeId: string;
  customSize?: { width: number; height: number };
  savedAt: number; // epoch ms
}
