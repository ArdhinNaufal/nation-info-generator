// Theme presets + bundled font catalogue + the default customization.

import type { Customization, FieldKey, ThemeColors } from '../data/types';
import { FIELD_KEYS } from '../data/types';
import { DEFAULT_LAYOUT_ID } from './layouts';

export interface ThemePreset {
  id: string;
  label: string;
  colors: ThemeColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'light', label: 'Light', colors: { background: '#f7f5f0', text: '#1c1b1a', accent: '#b4452f' } },
  { id: 'dark', label: 'Dark', colors: { background: '#15171c', text: '#f1f2f4', accent: '#5b9cff' } },
  { id: 'midnight', label: 'Midnight', colors: { background: '#0b1026', text: '#e7ecff', accent: '#ffcb47' } },
  { id: 'sepia', label: 'Sepia', colors: { background: '#efe3cf', text: '#3b2f23', accent: '#9a6b3f' } },
  { id: 'forest', label: 'Forest', colors: { background: '#10241b', text: '#e9f5ee', accent: '#6fd49a' } },
];

// Fonts bundled via @fontsource (imported in main.tsx). `family` is what canvas + CSS use.
export interface FontOption {
  id: string;
  label: string;
  family: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'inter', label: 'Inter (sans-serif)', family: '"Inter", system-ui, sans-serif' },
  { id: 'lora', label: 'Lora (serif)', family: '"Lora", Georgia, serif' },
  { id: 'montserrat', label: 'Montserrat (display)', family: '"Montserrat", system-ui, sans-serif' },
  { id: 'jetbrains', label: 'JetBrains Mono', family: '"JetBrains Mono", ui-monospace, monospace' },
];

export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 1.6;

export function getThemeById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((t) => t.id === id);
}

function allFieldsOn(): Record<FieldKey, boolean> {
  return FIELD_KEYS.reduce(
    (acc, k) => ((acc[k] = true), acc),
    {} as Record<FieldKey, boolean>,
  );
}

export function defaultCustomization(): Customization {
  const theme = THEME_PRESETS[1]; // dark
  return {
    themeId: theme.id,
    colors: { ...theme.colors },
    font: { family: FONT_OPTIONS[0].family, scale: 1 },
    fields: allFieldsOn(),
    layoutId: DEFAULT_LAYOUT_ID,
  };
}
