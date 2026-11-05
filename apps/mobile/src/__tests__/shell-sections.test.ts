import { BETA_1_FEATURES, FEATURES } from '@/config/features';
import type { Features } from '@/config/features';
import { SECTIONS, entryTestId, liveSections } from '@/shell/sections';

// The table of docs/ui-spec-v2.md 4.2 and the rule "nothing dead" (principle 4): an item or an
// entry of the bar is drawn only when the flag of its screen is on.

const keys = (features: Features) => liveSections(features).map((section) => section.key);
const entriesOf = (features: Features, key: string) =>
  liveSections(features)
    .find((section) => section.key === key)
    ?.entries?.map((entry) => entry.label);

describe('the sections of the bar', () => {
  it('has the eight sections in the order of the reference', () => {
    expect(SECTIONS.map((section) => section.key)).toEqual([
      'home',
      'search',
      'read',
      'scripture',
      'topics',
      'research',
      'resources',
      'about',
    ]);
  });

  it('shows only home, search and read while the other screens are not live', () => {
    expect(keys(FEATURES)).toEqual(['home', 'search', 'read']);
    expect(entriesOf(FEATURES, 'read')).toEqual(['curated', 'all', 'authors']);
  });

  it('shows home, search, read, research and about once the Beta 1 screens are live (check S1)', () => {
    expect(keys(BETA_1_FEATURES)).toEqual(['home', 'search', 'read', 'research', 'about']);
    expect(entriesOf(BETA_1_FEATURES, 'research')).toEqual(['ask', 'bookmarks']);
    expect(entriesOf(BETA_1_FEATURES, 'about')).toEqual(['aboutLibrary', 'transparency']);
  });

  it('drops an entry whose flag is off and a drawer that has no entry left', () => {
    const noAuthors = { ...FEATURES, authors: false };
    expect(entriesOf(noAuthors, 'read')).toEqual(['curated', 'all']);
    const noLibrary = { ...FEATURES, library: false, authors: false };
    expect(keys(noLibrary)).toEqual(['home', 'search']);
    expect(keys({ ...FEATURES, search: false })).toEqual(['home', 'read']);
  });

  it('keeps the entries of a drawer in their order when only some are live', () => {
    const onlyTransparency = { ...FEATURES, transparency: true };
    expect(keys(onlyTransparency)).toEqual(['home', 'search', 'read', 'about']);
    expect(entriesOf(onlyTransparency, 'about')).toEqual(['transparency']);
  });

  it('adds the later sections only when their flags are on', () => {
    const everything = Object.fromEntries(
      Object.keys(FEATURES).map((name) => [name, true]),
    ) as unknown as Features;
    expect(keys(everything)).toEqual([...SECTIONS.map((section) => section.key)]);
  });

  it('knows which section a location belongs to', () => {
    const owner = (pathname: string) =>
      SECTIONS.find((section) => section.owns(pathname))?.key ?? null;
    expect(owner('/')).toBe('home');
    expect(owner('/search')).toBe('search');
    expect(owner('/library')).toBe('read');
    expect(owner('/library/all')).toBe('read');
    expect(owner('/authors/vos')).toBe('read');
    // Reading a work belongs to "Citește", though no entry of its drawer is the current page.
    expect(owner('/work/abc')).toBe('read');
    expect(owner('/read/abc/def')).toBe('read');
    expect(owner('/ask')).toBe('research');
    expect(owner('/bookmarks')).toBe('research');
    expect(owner('/about/transparency')).toBe('about');
    // Settings and unknown pages belong to no section.
    expect(owner('/settings')).toBeNull();
    expect(owner('/nowhere')).toBeNull();
    // A prefix is a section only at a slash: "/library-old" is not "/library".
    expect(owner('/library-old')).toBeNull();
  });

  it('names the test id of a drawer entry after its section and path', () => {
    expect(entryTestId('read', '/library/all')).toBe('drawer-entry-read-library-all');
    expect(entryTestId('about', '/about')).toBe('drawer-entry-about-about');
    expect(entryTestId('read', '/')).toBe('drawer-entry-read-home');
  });

  it('gives every live link an address', () => {
    for (const section of liveSections(BETA_1_FEATURES)) {
      if (section.entries) {
        for (const entry of section.entries) expect(entry.path).toMatch(/^\//);
      } else {
        expect(section.path).toMatch(/^\//);
        expect(section.href).toBeDefined();
      }
    }
  });
});
