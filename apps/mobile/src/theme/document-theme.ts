import type { Palette, ThemeName } from './palettes';

/** The parts of `document` that follow the theme; a subset so tests can pass a plain object. */
export interface ThemedDocument {
  documentElement: {
    style: {
      colorScheme: string;
      backgroundColor: string;
      setProperty(name: string, value: string): void;
    };
  };
  body: { style: { backgroundColor: string } } | null;
  head: { appendChild(node: unknown): unknown } | null;
  querySelector(selectors: string): { setAttribute(name: string, value: string): void } | null;
  createElement(tag: string): { setAttribute(name: string, value: string): void };
}

/**
 * Web only: makes the page outside the app root follow the active palette: the background of the
 * root element and of the body (the canvas takes the root element's background: overscroll, the
 * area around the app root), the native widgets' `color-scheme` (form controls), the scrollbars
 * (thumb and track), the browser chrome colour and the CSS variables the HTML template reads
 * (`--app-background` for <html> and <body>, `--app-accent` for the focus ring, which is the
 * palette's `accentStrong`, and `--app-masthead-ink` for the ring on dark bands). The template
 * paints the stored or system scheme before this runs (`public/index.html`).
 */
export function applyDocumentTheme(doc: ThemedDocument, name: ThemeName, colors: Palette): void {
  const root = doc.documentElement.style;
  root.colorScheme = name === 'dark' ? 'dark' : 'light';
  root.backgroundColor = colors.background;
  root.setProperty('--app-background', colors.background);
  // The focus ring is `accentStrong`; a `masthead` band re-colours it with `--app-masthead-ink`.
  root.setProperty('--app-accent', colors.accentStrong);
  root.setProperty('--app-masthead-ink', colors.mastheadInk);
  // Inherited, so it reaches the scroll containers inside the app root as well as the page.
  root.setProperty('scrollbar-color', `${colors.borderStrong} ${colors.background}`);
  if (doc.body) doc.body.style.backgroundColor = colors.background;

  let meta = doc.querySelector('meta[name="theme-color"]');
  if (!meta) {
    const created = doc.createElement('meta');
    created.setAttribute('name', 'theme-color');
    doc.head?.appendChild(created);
    meta = created;
  }
  meta.setAttribute('content', colors.background);
}
