/**
 * Design tokens.
 *
 * Single source of truth for colors and spacing. Tailwind config reads these
 * via its own duplicated definition (Tailwind can't import TS at build time
 * easily). Keep both in sync.
 */
export const tokens = {
  colors: {
    paper:      '#F6F3EC',
    paperDeep:  '#F0ECE0',
    paperEdge:  '#E5E0D2',
    panel:      '#FFFFFF',
    ink:        '#1F1E1A',
    inkSoft:    '#6B6862',
    inkFaint:   '#A09C92',
    accent:     '#B85C2E',
    accentSoft: '#EBD3C4',
    accentDeep: '#8C3F1A',
    danger:     '#C44A1F',
    success:    '#3B7A4F',
    visited: [
      'rgba(184, 92, 46, 0.10)',
      'rgba(184, 92, 46, 0.20)',
      'rgba(184, 92, 46, 0.32)',
      'rgba(184, 92, 46, 0.48)',
      'rgba(184, 92, 46, 0.65)',
    ],
    map: {
      ocean:  '#C7DDE8',
      land:   '#F7EBC9',
      border: '#A98759',
      grat:   '#A8C5D8',
    },
  },
  spacing: {
    headerHeight: 64,
    sidebarWidth: 256,
  },
} as const

export type Tokens = typeof tokens
