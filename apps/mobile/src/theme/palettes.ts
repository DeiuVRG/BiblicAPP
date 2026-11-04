export type ThemeName = 'light' | 'sepia' | 'dark';
export type ThemePreference = 'system' | ThemeName;

export interface Palette {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  /** Links, the primary button, the active segment and the current-chapter rule. */
  accent: string;
  /** Text colour on top of `accent`. */
  onAccent: string;
  /** Background of search matches. */
  highlight: string;
  /** Text colour on top of `highlight`. */
  onHighlight: string;
  /** Background of the paragraph a search result jumped to. */
  target: string;
  statusBar: 'dark' | 'light';
}

// The only place where colours are written down: every component reads them through `useTheme()`
// (a test fails on colour literals anywhere else in `src`). All text/background pairs meet 4.5:1
// (WCAG AA), body text and muted text alike; `theme.test.ts` checks every pair.
export const palettes: Record<ThemeName, Palette> = {
  // Paper
  light: {
    background: '#FBFAF7',
    surface: '#F3F1EB',
    text: '#141414',
    textMuted: '#66645E',
    border: '#E3E0D8',
    accent: '#7A2E2A',
    onAccent: '#FFFFFF',
    highlight: '#F3E3A6',
    onHighlight: '#141414',
    target: '#F7F1DC',
    statusBar: 'dark',
  },
  sepia: {
    background: '#F4ECD8',
    surface: '#EADFC4',
    text: '#3B2F1E',
    textMuted: '#65553B',
    border: '#D2C3A0',
    accent: '#7A3E12',
    onAccent: '#FFFFFF',
    highlight: '#F0CE70',
    onHighlight: '#3B2F1E',
    target: '#EFE0B5',
    statusBar: 'dark',
  },
  // Ink
  dark: {
    background: '#141311',
    surface: '#1E1D1A',
    text: '#E9E6DF',
    textMuted: '#A5A29A',
    border: '#2E2C27',
    accent: '#E0A58B',
    onAccent: '#1A120F',
    highlight: '#5A4A12',
    onHighlight: '#FFFFFF',
    target: '#2A2718',
    statusBar: 'light',
  },
};

export function resolveTheme(
  preference: ThemePreference,
  system: 'light' | 'dark' | null | undefined,
): ThemeName {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}
