import { Platform } from 'react-native';

// The address of the site that a copied link points to (docs/ui-spec-v2.md, 8.9): on web the page's
// own origin plus the base path of the deployment (a GitHub Pages project site lives under
// `/BiblicAPP`); on iOS and Android the public site, `EXPO_PUBLIC_SITE_URL`, until the domain exists.

/** The site of the published web app, until the domain exists (roadmap section 9). */
export const SITE_URL_FALLBACK = 'https://deiuvrg.github.io/BiblicAPP';

/** `/BiblicAPP` for a build made for a base path, an empty string otherwise. */
function webBasePath(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (!raw || raw === '/') return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** The site root with no trailing slash: "https://deiuvrg.github.io/BiblicAPP". */
export function siteUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${webBasePath()}`;
  }
  const configured = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  return configured ? configured : SITE_URL_FALLBACK;
}

/**
 * The link to a section of a work, and to a paragraph of it: `<site>/read/<workId>/<sectionId>` and
 * `?p=<paragraphId>`. Ids are URL-safe by their schema; they are encoded all the same.
 */
export function readUrl(workId: string, sectionId: string, paragraphId?: string | null): string {
  const base = `${siteUrl()}/read/${encodeURIComponent(workId)}/${encodeURIComponent(sectionId)}`;
  return paragraphId ? `${base}?p=${encodeURIComponent(paragraphId)}` : base;
}
