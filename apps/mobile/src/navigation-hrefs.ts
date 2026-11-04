// Typed-route objects. Object hrefs avoid string interpolation of ids into paths.
export const libraryHref = '/' as const;
export const searchHref = '/search' as const;
export const settingsHref = '/settings' as const;

/** The work page; `edition` selects an edition (the page opens the primary one without it). */
export const workHref = (id: string, edition?: string) =>
  ({
    pathname: '/work/[id]',
    params: { id, ...(edition === undefined ? null : { edition }) },
  }) as const;

export const readHref = (id: string, section: string, extra?: { p?: string; q?: string }) =>
  ({ pathname: '/read/[id]/[section]', params: { id, section, ...extra } }) as const;
