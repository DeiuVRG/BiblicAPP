// Typed-route objects. Object hrefs avoid string interpolation of ids into paths.
export const libraryHref = '/' as const;
export const searchHref = '/search' as const;
export const settingsHref = '/settings' as const;

export const workHref = (id: string) => ({ pathname: '/work/[id]', params: { id } }) as const;

export const readHref = (id: string, section: string, extra?: { p?: string; q?: string }) =>
  ({ pathname: '/read/[id]/[section]', params: { id, section, ...extra } }) as const;
