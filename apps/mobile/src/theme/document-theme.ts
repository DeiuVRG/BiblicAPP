import type { Palette, ThemeName } from './palettes';

/** The parts of `document` that follow the theme; a subset so tests can pass a plain object. */
export interface ThemedDocument {
  documentElement: { style: { colorScheme: string; backgroundColor: string } };
  body: { style: { backgroundColor: string } } | null;
  head: { appendChild(node: unknown): unknown } | null;
  querySelector(selectors: string): { setAttribute(name: string, value: string): void } | null;
  createElement(tag: string): { setAttribute(name: string, value: string): void };
}

/**
 * Web only: makes the page outside the app root follow the active palette: the background of the
 * root element and of the body (the canvas takes the root element's background: overscroll, the
 * area around the app root), the native widgets' `color-scheme` (scrollbars, form controls) and
 * the browser chrome colour. The HTML template paints the stored or system scheme before this
 * runs (`public/index.html`).
 */
export function applyDocumentTheme(doc: ThemedDocument, name: ThemeName, colors: Palette): void {
  doc.documentElement.style.colorScheme = name === 'dark' ? 'dark' : 'light';
  doc.documentElement.style.backgroundColor = colors.background;
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
