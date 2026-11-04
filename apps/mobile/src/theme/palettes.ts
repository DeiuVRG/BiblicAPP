export type ThemeName = 'light' | 'sepia' | 'dark';
export type ThemePreference = 'system' | ThemeName;

/**
 * The colour tokens of a theme (docs/ui-spec-v2.md, section 2.1). The interface is flat on
 * purpose: scripts/generate-icons.mjs and scripts/check-web-theme.mjs read this file with a regular
 * expression that stops at the first closing brace of a palette and keeps only the quoted
 * six-digit values, so no token may be an object and the eight-digit values (`#RRGGBBAA`) are
 * skipped by them safely.
 */
export interface Palette {
  /** Page ground, section bar, text area. */
  background: string;
  /** Cards, inputs, popovers, toolbar buttons (the card colour; it was the tinted block colour in v1). */
  surface: string;
  /** Brand bar, reader toolbar, outline panel, beta band. */
  cream: string;
  /** Warm bands and plates: only `text` is placed on it. */
  warm: string;
  text: string;
  /** Meta, counts, inactive items. Never on `warm` or `highlight` (4.14:1 and 4.49:1 in light). */
  textMuted: string;
  /** Hairlines, card borders, separators: quiet on purpose. */
  border: string;
  /** Outline of controls (inputs, segmented control, secondary buttons): 3:1. */
  borderStrong: string;
  /** The brand colour: fills without text, the focus underline of tabs, graphics. Never small text. */
  accent: string;
  /** Links, small-caps labels, the primary button fill, citation chips: 4.5:1 text. */
  accentStrong: string;
  /** Hover and pressed state of `accentStrong`. */
  accentHover: string;
  /** Label on `accentStrong` (and on `accent` in sepia and dark). */
  onAccent: string;
  /** Background of search matches and of the amber highlight. */
  highlight: string;
  /** Text colour on top of `highlight`. */
  onHighlight: string;
  /** Background of the paragraph a link jumped to (fades in over 300 ms). */
  target: string;
  /** Dark bands: the landing hero overlay, the "Autori" band, the footer. */
  masthead: string;
  /** Text on `masthead`. */
  mastheadInk: string;
  /** Kickers, numerals and plain links on `masthead` (never `accentStrong`: 2.64:1). */
  mastheadAccent: string;
  /** Error text. */
  danger: string;
  statusBar: 'dark' | 'light';

  // Derived tokens (flat strings, `#RRGGBB` or `#RRGGBBAA`): every colour that the spec writes as a
  // literal anywhere else is one of these, so no other file has to write a colour.
  /** Backdrop of dialogs and sheets (45 %; dark 65 %). */
  scrimDialog: string;
  /** Backdrop of drawers (38 %; dark 65 %). */
  scrimDrawer: string;
  /** First layer of the card hover shadow (4 %). */
  shadowEdge: string;
  /** Second layer of the card hover shadow (6 %). */
  shadowSoft: string;
  /** Popovers (12 %; dark 40 %). */
  shadowPopover: string;
  /** Dialogs (25 %; dark 60 %). */
  shadowDialog: string;
  /** Phone drawer panel (45 %; dark 70 %). */
  shadowDrawer: string;
  /** Upper stop of the hero scrim (alpha 0.72): even a white pixel behind the text gives 4.7:1. */
  heroScrimTop: string;
  /** Lower stop of the hero scrim. */
  heroScrimBottom: string;
  /** `mastheadInk` at 84 % (hero sub text). */
  mastheadInkMuted: string;
  /** `mastheadInk` at 55 % (border of the ghost button). */
  mastheadBorder: string;
  /** `accent` at 78 % (the hero highlight bar). */
  accentBar: string;
  /** The five highlight washes; the text on every wash is `text`. */
  washAmber: string;
  washSage: string;
  washSlate: string;
  washRose: string;
  washLilac: string;
  /** The swatch dots of the washes: decoration only (outlined with `borderStrong`). */
  washRingAmber: string;
  washRingSage: string;
  washRingSlate: string;
  washRingRose: string;
  washRingLilac: string;
}

// The only place where colours are written down: every component reads them through `useTheme()`
// (a test fails on colour literals anywhere else in `src`). `theme.test.ts` lists every pair of
// docs/ui-spec-v2.md section 2.1 with the ratio the spec publishes for it.
export const palettes: Record<ThemeName, Palette> = {
  // Paper
  light: {
    background: '#F6F3F2',
    surface: '#FFFDFA',
    cream: '#F5EFE1',
    warm: '#F1E0C9',
    text: '#2D2927',
    textMuted: '#6F6A64',
    border: '#D9C6A7',
    borderStrong: '#8A7F6E',
    accent: '#C1593C',
    accentStrong: '#A8462B',
    accentHover: '#8F3B23',
    onAccent: '#FFFFFF',
    highlight: '#FBE9C8',
    onHighlight: '#2D2927',
    target: '#F7F1DC',
    masthead: '#2A231D',
    mastheadInk: '#EFE7DA',
    mastheadAccent: '#EE7D51',
    danger: '#9C4126',
    statusBar: 'dark',
    scrimDialog: '#22232073',
    scrimDrawer: '#2D292761',
    shadowEdge: '#2D29270A',
    shadowSoft: '#2D29270F',
    shadowPopover: '#0000001F',
    shadowDialog: '#00000040',
    shadowDrawer: '#00000073',
    heroScrimTop: '#2D2927B8',
    heroScrimBottom: '#2D2927E0',
    mastheadInkMuted: '#EFE7DAD6',
    mastheadBorder: '#EFE7DA8C',
    accentBar: '#C1593CC7',
    washAmber: '#FBE9C8',
    washSage: '#E7EFE0',
    washSlate: '#E5ECF3',
    washRose: '#F3E0E4',
    washLilac: '#E9E1F2',
    washRingAmber: '#E8B04B',
    washRingSage: '#8FAE6F',
    washRingSlate: '#7D97BD',
    washRingRose: '#D4879A',
    washRingLilac: '#9A86C4',
  },
  sepia: {
    background: '#EEE7D9',
    surface: '#FAF6EC',
    cream: '#E8E0CF',
    warm: '#E2D5BB',
    text: '#302C24',
    textMuted: '#5F574A',
    border: '#D8D0C1',
    borderStrong: '#857759',
    accent: '#B5502F',
    accentStrong: '#9C4126',
    accentHover: '#823620',
    onAccent: '#FFFFFF',
    highlight: '#F0DFA8',
    onHighlight: '#302C24',
    target: '#E7DFCF',
    masthead: '#2A231D',
    mastheadInk: '#EFE7DA',
    mastheadAccent: '#EE7D51',
    danger: '#8F3B23',
    statusBar: 'dark',
    scrimDialog: '#22232073',
    scrimDrawer: '#2D292761',
    shadowEdge: '#2D29270A',
    shadowSoft: '#2D29270F',
    shadowPopover: '#0000001F',
    shadowDialog: '#00000040',
    shadowDrawer: '#00000073',
    heroScrimTop: '#2D2927B8',
    heroScrimBottom: '#2D2927E0',
    mastheadInkMuted: '#EFE7DAD6',
    mastheadBorder: '#EFE7DA8C',
    accentBar: '#B5502FC7',
    washAmber: '#F0DFA8',
    washSage: '#D9E3CC',
    washSlate: '#D3DEE8',
    washRose: '#EAD0D5',
    washLilac: '#DDD2EA',
    washRingAmber: '#E8B04B',
    washRingSage: '#8FAE6F',
    washRingSlate: '#7D97BD',
    washRingRose: '#D4879A',
    washRingLilac: '#9A86C4',
  },
  // Ink
  dark: {
    background: '#222320',
    surface: '#2B2C29',
    cream: '#242521',
    warm: '#33302A',
    text: '#E9E9E5',
    textMuted: '#B0B0A8',
    border: '#454740',
    borderStrong: '#7C7D73',
    accent: '#D79380',
    accentStrong: '#E3A58F',
    accentHover: '#EBB6A3',
    onAccent: '#222320',
    highlight: '#4D3B1C',
    onHighlight: '#F3EEE2',
    target: '#2F2D22',
    masthead: '#15120E',
    mastheadInk: '#EFE7DA',
    mastheadAccent: '#EE7D51',
    danger: '#EBA08C',
    statusBar: 'light',
    scrimDialog: '#000000A6',
    scrimDrawer: '#000000A6',
    shadowEdge: '#2D29270A',
    shadowSoft: '#2D29270F',
    shadowPopover: '#00000066',
    shadowDialog: '#00000099',
    shadowDrawer: '#000000B3',
    heroScrimTop: '#15120ED1',
    heroScrimBottom: '#15120EF9',
    mastheadInkMuted: '#EFE7DAD6',
    mastheadBorder: '#EFE7DA8C',
    accentBar: '#D79380C7',
    washAmber: '#4D3B1C',
    washSage: '#2C3A2A',
    washSlate: '#26313F',
    washRose: '#46282F',
    washLilac: '#372848',
    washRingAmber: '#E8B04B',
    washRingSage: '#8FAE6F',
    washRingSlate: '#7D97BD',
    washRingRose: '#D4879A',
    washRingLilac: '#9A86C4',
  },
};

export function resolveTheme(
  preference: ThemePreference,
  system: 'light' | 'dark' | null | undefined,
): ThemeName {
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}
