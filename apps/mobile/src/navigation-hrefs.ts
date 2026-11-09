import type { Link } from 'expo-router';
import type { ComponentProps } from 'react';

// Typed-route objects. Object hrefs avoid string interpolation of ids into paths.

/** Whatever a `Link` takes as its `href`. */
export type AppHref = ComponentProps<typeof Link>['href'];

/**
 * An href to a route that the typed-routes file may not know yet (a section that is not live, an
 * entry of a drawer behind a flag): the route table of docs/ui-spec-v2.md 4.4 is the authority.
 */
export const futureHref = (path: string): AppHref => path as unknown as AppHref;

export const homeHref = '/' as const;
/** Selecție, the curated page of the library. */
export const libraryHref = '/library' as const;
/** Toată biblioteca: every work, with its filters in the query string. */
export const libraryAllHref = '/library/all' as const;
export const authorsHref = '/authors' as const;
export const searchHref = '/search' as const;
export const settingsHref = '/settings' as const;

/** The full library with filters (`shelf`, `century`, `q`, ...); defaults are left out by the caller. */
export const libraryAllWith = (params: Record<string, string>) =>
  (Object.keys(params).length === 0
    ? libraryAllHref
    : { pathname: '/library/all', params }) as AppHref;

/** The author page. */
export const authorHref = (slug: string) =>
  ({ pathname: '/authors/[slug]', params: { slug } }) as AppHref;

/** The work page; `edition` selects an edition (the page opens the primary one without it). */
export const workHref = (id: string, edition?: string) =>
  ({
    pathname: '/work/[id]',
    params: { id, ...(edition === undefined ? null : { edition }) },
  }) as const;

/**
 * The reader at a section: `p` a paragraph to jump to, `q` words to find, `lang` the language of the
 * edition to read (the reader opens the aligned section of that edition) and `pair` two editions read
 * side by side ("ro+en"). A param that is not given is not written.
 */
export const readHref = (
  id: string,
  section: string,
  extra?: { p?: string; q?: string; lang?: string; pair?: string },
) => ({ pathname: '/read/[id]/[section]', params: { id, section, ...extra } }) as const;

/** The policy page: how the texts of the library are made and checked. */
export const transparencyHref = '/about/transparency' as const;
