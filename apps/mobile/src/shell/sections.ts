import type { Features } from '@/config/features';
import type { AppHref } from '@/navigation-hrefs';
import { futureHref } from '@/navigation-hrefs';

// The sections of the section bar and their drawers (docs/ui-spec-v2.md, 4.2 and 4.3), in the
// reference's order. Everything the bar shows comes from this table and the feature flags: an entry
// whose flag is off is not rendered, and a bar item with no live entry is not rendered either.

export type SectionKey =
  'home' | 'search' | 'read' | 'scripture' | 'topics' | 'research' | 'resources' | 'about';

/** The names of the strings of `t.nav` that label a bar item or a drawer entry. */
export type NavLabel =
  | 'home'
  | 'search'
  | 'read'
  | 'curated'
  | 'all'
  | 'authors'
  | 'traditions'
  | 'guides'
  | 'dictionary'
  | 'scripture'
  | 'topics'
  | 'resources'
  | 'research'
  | 'ask'
  | 'bookmarks'
  | 'notebook'
  | 'semantic'
  | 'compare'
  | 'connections'
  | 'lexicon'
  | 'decks'
  | 'disputed'
  | 'indexes'
  | 'scans'
  | 'desk'
  | 'about'
  | 'aboutLibrary'
  | 'transparency'
  | 'howTo'
  | 'tour';

export interface SectionEntry {
  /** The label in `t.nav`. */
  label: NavLabel;
  /** The path (no query): what `aria-current="page"` compares with. */
  path: string;
  href: AppHref;
  feature: keyof Features;
}

export interface SectionDefinition {
  key: SectionKey;
  label: NavLabel;
  feature: keyof Features | null;
  /** A link item: where it goes. */
  path?: string;
  href?: AppHref;
  /** A drawer item: its entries, in order. */
  entries?: readonly SectionEntry[];
  /** True when a location belongs to the section (the item gets the "current" style). */
  owns(pathname: string): boolean;
}

const entry = (
  label: NavLabel,
  path: string,
  feature: keyof Features,
  href: AppHref = futureHref(path),
): SectionEntry => ({ label, path, href, feature });

const startsWith = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** The table of 4.2. `home` is the brand item "BIBLIOTECA | ACASĂ". */
export const SECTIONS: readonly SectionDefinition[] = [
  {
    key: 'home',
    label: 'home',
    feature: null,
    path: '/',
    href: futureHref('/'),
    owns: (pathname) => pathname === '/' || pathname === '',
  },
  {
    key: 'search',
    label: 'search',
    feature: 'search',
    path: '/search',
    href: futureHref('/search'),
    owns: (pathname) => startsWith(pathname, ['/search']),
  },
  {
    key: 'read',
    label: 'read',
    feature: null,
    entries: [
      entry('curated', '/library', 'library'),
      entry('all', '/library/all', 'library'),
      entry('authors', '/authors', 'authors'),
      entry('traditions', '/traditions', 'traditions'),
      entry('guides', '/guides', 'guides'),
      entry('dictionary', '/dictionary', 'dictionary'),
    ],
    // Reading a work belongs to "Citește" too, though no entry is the current page there.
    owns: (pathname) =>
      startsWith(pathname, [
        '/library',
        '/authors',
        '/traditions',
        '/guides',
        '/dictionary',
        '/work',
        '/read',
      ]),
  },
  {
    key: 'scripture',
    label: 'scripture',
    feature: 'scripture',
    path: '/scripture',
    href: futureHref('/scripture'),
    owns: (pathname) => startsWith(pathname, ['/scripture']),
  },
  {
    key: 'topics',
    label: 'topics',
    feature: 'topics',
    path: '/topics',
    href: futureHref('/topics'),
    owns: (pathname) => startsWith(pathname, ['/topics']),
  },
  {
    key: 'research',
    label: 'research',
    feature: null,
    entries: [
      entry('ask', '/ask', 'ask'),
      entry('bookmarks', '/bookmarks', 'bookmarks'),
      entry('notebook', '/notebook', 'notebook'),
      entry('semantic', '/search', 'semantic', futureHref('/search?mode=meaning')),
      entry('compare', '/research/compare', 'compare'),
      entry('connections', '/research/connections', 'connections'),
      entry('lexicon', '/research/lexicon', 'lexicon'),
      entry('decks', '/research/decks', 'decks'),
      entry('disputed', '/research/disputed', 'disputed'),
      entry('indexes', '/research/indexes', 'indexes'),
      entry('scans', '/research/scans', 'scans'),
      entry('desk', '/desk', 'desk'),
    ],
    owns: (pathname) =>
      startsWith(pathname, ['/ask', '/bookmarks', '/notebook', '/research', '/desk']),
  },
  {
    key: 'resources',
    label: 'resources',
    feature: 'resources',
    path: '/resources',
    href: futureHref('/resources'),
    owns: (pathname) => startsWith(pathname, ['/resources']),
  },
  {
    key: 'about',
    label: 'about',
    feature: null,
    entries: [
      entry('aboutLibrary', '/about', 'about'),
      entry('transparency', '/about/transparency', 'transparency'),
      entry('howTo', '/about/how-to', 'howTo'),
      entry('tour', '/about/tour', 'tour'),
    ],
    owns: (pathname) => startsWith(pathname, ['/about']),
  },
];

/** A section as the bar shows it: a link, or a drawer with the entries that are live. */
export interface LiveSection {
  key: SectionKey;
  label: NavLabel;
  path?: string;
  href?: AppHref;
  entries?: readonly SectionEntry[];
  owns(pathname: string): boolean;
}

/** The sections that are live under these flags: no dead link, no empty drawer. */
export function liveSections(features: Features): LiveSection[] {
  const live: LiveSection[] = [];
  for (const section of SECTIONS) {
    if (section.entries) {
      const entries = section.entries.filter((candidate) => features[candidate.feature]);
      if (entries.length > 0) live.push({ ...section, entries });
    } else if (section.feature === null || features[section.feature]) {
      live.push(section);
    }
  }
  return live;
}

/** The test id of a drawer entry: its path without the slash, slashes as hyphens ("library-all"). */
export function entryTestId(section: SectionKey, path: string): string {
  return `drawer-entry-${section}-${path.replace(/^\//, '').replace(/\//g, '-') || 'home'}`;
}
