// Layout-preset metadata. The actual arrangement logic lives in wallpaper.ts and switches
// on `id`; this module is the user-facing catalogue (SPEC §2: preset-only, no free layout).

export interface LayoutPreset {
  id: string;
  label: string;
  description: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Flag and title across the top, facts in a single column below.',
  },
  {
    id: 'sidebar',
    label: 'Sidebar',
    description: 'Flag and title in a left column, facts listed on the right.',
  },
  {
    id: 'grid',
    label: 'Grid',
    description: 'Header on top, facts laid out as a two-column card grid.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Large centered country name with a few key facts and lots of space.',
  },
];

export const DEFAULT_LAYOUT_ID = 'classic';

export function isLayoutId(id: string): boolean {
  return LAYOUT_PRESETS.some((l) => l.id === id);
}
