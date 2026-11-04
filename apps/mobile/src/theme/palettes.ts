export type ThemeName = 'light' | 'sepia' | 'dark';
export type ThemePreference = 'system' | ThemeName;

export interface Palette {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
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

// Text/background contrast ratios are all above 4.5:1 (WCAG AA) for body text and muted text.
export const palettes: Record<ThemeName, Palette> = {
  light: {
    background: '#FFFFFF',
    surface: '#F3F3F0',
    text: '#1A1A1A',
    textMuted: '#555555',
    border: '#D6D6D0',
    accent: '#1F4E8C',
    onAccent: '#FFFFFF',
    highlight: '#FFE58A',
    onHighlight: '#1A1A1A',
    target: '#FFF6D1',
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
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    text: '#E8E6E1',
    textMuted: '#A9A9A3',
    border: '#383838',
    accent: '#8DB6F0',
    onAccent: '#0B1220',
    highlight: '#7A6500',
    onHighlight: '#FFFFFF',
    target: '#2A2A1A',
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
