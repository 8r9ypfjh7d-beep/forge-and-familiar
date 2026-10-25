// Per-character visual themes. Pure data and helpers; the React glue is in useCharacterTheme.ts.
// A theme overrides the app's colour tokens from index.css while that character's sheet is open.

export interface ThemeTokens {
  bg: string
  panel: string
  ink: string
  muted: string
  line: string
  accent: string
  accentSoft: string
  good: string
  bad: string
  /** Temp HP colour on the live sheet. */
  temp: string
}

export interface Theme {
  id: string
  name: string
  blurb: string
  scheme: 'light' | 'dark'
  tokens: ThemeTokens
  /** Soft page backdrop drawn behind the sheet. */
  backdrop: string
}

/** Used when a character has no theme or an unknown one: the app's own light/dark look. */
export const DEFAULT_THEME_ID = 'default'

export const THEMES: Theme[] = [
  {
    id: 'parchment', name: 'Parchment', blurb: 'Warm vellum and bronze ink', scheme: 'light',
    tokens: {
      bg: '#ecdfc2', panel: '#faf3e1', ink: '#2b2014', muted: '#66553e', line: '#d6c39b',
      accent: '#7a4a12', accentSoft: '#ecd8ae', good: '#2f6b3a', bad: '#9e2a1c', temp: '#2f5f9e',
    },
    backdrop: 'radial-gradient(ellipse at top, #f6ecd4, transparent 70%)',
  },
  {
    id: 'shadow', name: 'Shadow', blurb: 'Night-dark with a violet edge', scheme: 'dark',
    tokens: {
      bg: '#111216', panel: '#1b1d23', ink: '#e6e6ea', muted: '#9a9cab', line: '#2e313b',
      accent: '#6a63d6', accentSoft: '#26254a', good: '#34784b', bad: '#c2453a', temp: '#7aa7e0',
    },
    backdrop: 'radial-gradient(ellipse at top, #1d1f2a, transparent 70%)',
  },
  {
    id: 'arcane', name: 'Arcane', blurb: 'Deep violet and starlight', scheme: 'dark',
    tokens: {
      bg: '#16122a', panel: '#211b3a', ink: '#ece8fb', muted: '#a69ec8', line: '#3a3160',
      accent: '#8a52d6', accentSoft: '#33275a', good: '#34784b', bad: '#c2453a', temp: '#8fb6ee',
    },
    backdrop: 'radial-gradient(ellipse at top, #2a2050, transparent 70%)',
  },
  {
    id: 'verdant', name: 'Verdant', blurb: 'Moss, bark and forest light', scheme: 'light',
    tokens: {
      bg: '#e4ecdc', panel: '#f7fbf2', ink: '#1e2a1c', muted: '#526248', line: '#c6d5b8',
      accent: '#3f6420', accentSoft: '#d9e8c6', good: '#2a6a3c', bad: '#9e2a1c', temp: '#2f5f9e',
    },
    backdrop: 'radial-gradient(ellipse at top, #f0f6e8, transparent 70%)',
  },
  {
    id: 'ember', name: 'Ember', blurb: 'Smouldering coals and flame', scheme: 'dark',
    tokens: {
      bg: '#1a0f0c', panel: '#261612', ink: '#f3e4dc', muted: '#b39488', line: '#45281f',
      accent: '#c0391b', accentSoft: '#45201a', good: '#34784b', bad: '#c43a3a', temp: '#7aa7e0',
    },
    backdrop: 'radial-gradient(ellipse at top, #36160e, transparent 70%)',
  },
  {
    id: 'frost', name: 'Frost', blurb: 'Steel blue and winter air', scheme: 'light',
    tokens: {
      bg: '#e4ebf2', panel: '#f8fbfd', ink: '#1a2430', muted: '#4f6078', line: '#c6d3e0',
      accent: '#2c5d8f', accentSoft: '#d5e3f1', good: '#2f6b3a', bad: '#a3271b', temp: '#6a3fa0',
    },
    backdrop: 'radial-gradient(ellipse at top, #f2f7fb, transparent 70%)',
  },
]

const SUGGESTED: Record<string, string> = {
  barbarian: 'ember', bard: 'arcane', cleric: 'parchment', druid: 'verdant', fighter: 'frost', monk: 'frost',
  paladin: 'parchment', ranger: 'verdant', rogue: 'shadow', sorcerer: 'ember', warlock: 'shadow', wizard: 'arcane',
}

export const themeById = (id: string | undefined): Theme | undefined => THEMES.find(t => t.id === id)

/** The theme that fits a class, offered first in the picker. */
export const suggestedThemeId = (classId: string | undefined): string | undefined =>
  classId ? SUGGESTED[classId] : undefined

/** CSS custom properties for a theme, named after the app tokens in index.css (plus the dice tray's). */
export function themeVars(t: Theme): Record<string, string> {
  const k = t.tokens
  return {
    '--bg': k.bg, '--panel': k.panel, '--ink': k.ink, '--muted': k.muted, '--line': k.line,
    '--accent': k.accent, '--accent-ink': '#fff', '--accent-soft': k.accentSoft,
    '--good': k.good, '--bad': k.bad, '--temp': k.temp,
    '--ff-surface': k.panel, '--ff-text': k.ink, '--ff-text-muted': k.muted, '--ff-border': k.line,
    '--ff-accent': k.accent, '--ff-accent-text': '#fff',
  }
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
