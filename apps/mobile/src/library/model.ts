import type { Catalogue, CatalogueAuthor, CatalogueWork, WorkKind } from '@biblioteca/shared';

import { isPartialEdition } from '@/content/editions';
import { workTitle } from '@/content/titles';
import type { WorkSummary } from '@/content/types';
import { centuryOfYear } from '@/i18n/centuries';
import { baseLanguage } from '@/i18n/language';
import type { ReadingLanguage } from '@/i18n/language';
import { foldText } from '@/search/fold';

// The model of the library (docs/ui-spec-v2.md, section 6): the works that the packs install,
// joined with the editorial records of the verified catalogue, and everything the screens count,
// group, sort and filter, derived once so that every number on every screen agrees (principle 10).
// Pure: no React, no strings of the interface (those come with the screens). A work without a
// catalogue entry still lists, on the shelf "Altele" and without a blurb, so that a pack never
// disappears for a missing editorial record (6.8).

/** The shelf of the works that have no catalogue entry (or sit on no shelf). */
export const OTHER_SHELF = 'other';
const OTHER_LABELS = { ro: 'Altele', en: 'Other' } as const;

export type GroupKind = 'author' | 'body' | 'name';

/**
 * Who a work is filed under: a person of the catalogue, an issuing body (a council, a church: the
 * works that have no individual author, which take the place of the author in the A-Z bar, the sort
 * and the accordions), or a name that only the pack knows.
 */
export interface LibraryGroup {
  key: string;
  kind: GroupKind;
  /** The catalogue slug of the author or the issuing body; null for a name only the pack knows. */
  slug: string | null;
  nameRo: string;
  nameEn: string;
  nameOrig: string;
  /** What the group is filed and sorted under ("Vos, Geerhardus"); folded in `sortKey`. */
  sortName: string;
  sortKey: string;
  /** The entry of the A-Z bar: the folded first letter of the sort name, "#" for anything else. */
  letter: string;
  born: number | null;
  died: number | null;
  /** An issuing body: the year it issued its documents (325 for Nicaea I). */
  year: number | null;
  tradition: string | null;
  workIds: string[];
}

export interface LibraryWork {
  workId: string;
  slug: string;
  summary: WorkSummary;
  /** The editorial record; null for a work that only a pack describes. */
  entry: CatalogueWork | null;
  groupKey: string;
  /** Slugs of the shelves it sits on (`OTHER_SHELF` when it has no entry). */
  shelves: string[];
  kind: WorkKind | null;
  /** The year of the original. */
  year: number | null;
  /** The century of the original (6.4); null when there is no date to derive it from. */
  century: number | null;
}

export interface LibraryShelf {
  slug: string;
  order: number;
  labelRo: string;
  labelEn: string;
  descRo: string;
  descEn: string;
  workIds: string[];
  /** Up to five surnames (or issuing bodies) of the shelf, alphabetically, for the who-line. */
  who: string[];
}

export interface CenturyCount {
  century: number;
  count: number;
}

export interface LibraryTotals {
  works: number;
  editions: number;
  /** The base codes of the languages of all editions ("ro", "en", "la"), sorted. */
  languages: string[];
  /** People (authors known to the catalogue or to a pack), not issuing bodies. */
  authors: number;
}

export interface LibraryModel {
  /** The verified catalogue the model was joined with; null when there is none. */
  catalogue: Catalogue | null;
  /** In the default order: the editorial "start here" list first, then by year of the original. */
  works: LibraryWork[];
  /** Shelves that hold at least one work, by `order` ("Altele" last). */
  shelves: LibraryShelf[];
  /** Sorted by the folded sort name. */
  groups: LibraryGroup[];
  /** Centuries that have at least one work, ascending. */
  centuries: CenturyCount[];
  /** Works with no date to derive a century from. */
  undated: number;
  totals: LibraryTotals;
  workById: ReadonlyMap<string, LibraryWork>;
  groupByKey: ReadonlyMap<string, LibraryGroup>;
}

// --- names --------------------------------------------------------------------------------------

/** The name of a group in the reading language ("Augustin" / "Augustine"). */
export function groupName(group: LibraryGroup, language: ReadingLanguage): string {
  return language === 'ro' ? group.nameRo : group.nameEn;
}

/** The surname part of a sort name ("Vos, Geerhardus" gives "Vos"; a name without a comma stays). */
export function surnameOf(sortName: string): string {
  const [first = sortName] = sortName.split(',');
  return first.trim() || sortName;
}

/** The letter a sort key is filed under: A to Z, or "#" for a name that does not start with one. */
export function letterOf(sortKey: string): string {
  const first = sortKey.trimStart().charAt(0);
  return /[a-z]/.test(first) ? first.toUpperCase() : '#';
}

const collator = typeof Intl !== 'undefined' && 'Collator' in Intl ? new Intl.Collator('ro') : null;

/**
 * Compares two folded sort keys. The folded key decides; `Intl.Collator('ro')` is only the
 * tie-break (its order comes from the platform ICU and differs between iOS and Android, so no
 * collation order is ever asserted on a device; docs/ui-spec-v2.md 6.2 and 17.5).
 */
export function compareSortKeys(
  a: { sortKey: string; sortName: string },
  b: { sortKey: string; sortName: string },
): number {
  if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
  return collator ? collator.compare(a.sortName, b.sortName) : 0;
}

// --- centuries ----------------------------------------------------------------------------------

/**
 * The century of a work (6.4): the editorial override when there is one, else `ceil(year / 100)` of
 * the year of the original, else the midpoint of the author's years, else none.
 */
export function centuryOfWork(
  year: number | null,
  override: number | undefined,
  born: number | null,
  died: number | null,
): number | null {
  if (override !== undefined) return override;
  if (year !== null) return centuryOfYear(year);
  if (born !== null && died !== null) return centuryOfYear(Math.round((born + died) / 2));
  const known = died ?? born;
  return known === null ? null : centuryOfYear(known);
}

// --- building -----------------------------------------------------------------------------------

function authorGroup(author: CatalogueAuthor): LibraryGroup {
  const sortName = author.sortName ?? author.nameOrig;
  return {
    key: `author:${author.slug}`,
    kind: 'author',
    slug: author.slug,
    nameRo: author.nameRo,
    nameEn: author.nameEn,
    nameOrig: author.nameOrig,
    sortName,
    sortKey: foldText(sortName),
    letter: letterOf(foldText(sortName)),
    born: author.born,
    died: author.died,
    year: null,
    tradition: author.tradition === '' ? null : author.tradition,
    workIds: [],
  };
}

function bodyGroup(
  body: NonNullable<CatalogueWork['issuingBody']>,
  language: ReadingLanguage,
): LibraryGroup {
  const sortName = language === 'ro' ? body.labelRo : body.labelEn;
  return {
    key: `body:${body.slug}`,
    kind: 'body',
    slug: body.slug,
    nameRo: body.labelRo,
    nameEn: body.labelEn,
    nameOrig: body.labelEn,
    sortName,
    sortKey: foldText(sortName),
    letter: letterOf(foldText(sortName)),
    born: null,
    died: null,
    year: body.year ?? null,
    tradition: null,
    workIds: [],
  };
}

function nameGroup(summary: WorkSummary): LibraryGroup {
  const name = summary.authorName;
  return {
    key: `name:${foldText(name)}`,
    kind: 'name',
    slug: null,
    nameRo: name,
    nameEn: name,
    nameOrig: name,
    sortName: name,
    sortKey: foldText(name),
    letter: letterOf(foldText(name)),
    born: summary.authorBorn,
    died: summary.authorDied,
    year: null,
    tradition: null,
    workIds: [],
  };
}

/** Oldest first, works without a year last; ties by the folded title (a stable, explicit order). */
function compareWorks(a: LibraryWork, b: LibraryWork): number {
  if (a.year !== b.year) {
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    return a.year - b.year;
  }
  const left = foldText(a.summary.titleOrig);
  const right = foldText(b.summary.titleOrig);
  return left < right ? -1 : left > right ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Joins the installed works with the verified catalogue (or with nothing: then every work lists on
 * "Altele") and derives the counts, the groups, the shelves and the centuries of the library.
 * `language` is the reading language: it decides how issuing bodies and unnamed authors are
 * sorted, as people are always filed under their `sortName`.
 */
export function buildLibraryModel(
  summaries: readonly WorkSummary[],
  catalogue: Catalogue | null,
  language: ReadingLanguage,
): LibraryModel {
  const entries = new Map((catalogue?.works ?? []).map((work) => [work.workId, work]));
  const authors = new Map((catalogue?.authors ?? []).map((author) => [author.slug, author]));
  const authorsByName = new Map<string, CatalogueAuthor>();
  for (const author of authors.values()) {
    for (const name of [author.nameRo, author.nameEn, author.nameOrig]) {
      authorsByName.set(foldText(name), author);
    }
  }
  const shelfSlugs = new Set((catalogue?.shelves ?? []).map((shelf) => shelf.slug));

  const groups = new Map<string, LibraryGroup>();
  const groupFor = (summary: WorkSummary, entry: CatalogueWork | null): LibraryGroup => {
    const author =
      entry?.authorSlug !== undefined
        ? authors.get(entry.authorSlug)
        : entry === null
          ? authorsByName.get(foldText(summary.authorName))
          : undefined;
    const candidate = author
      ? authorGroup(author)
      : entry?.issuingBody
        ? bodyGroup(entry.issuingBody, language)
        : nameGroup(summary);
    const known = groups.get(candidate.key);
    if (known) return known;
    groups.set(candidate.key, candidate);
    return candidate;
  };

  const works: LibraryWork[] = summaries.map((summary) => {
    const entry = entries.get(summary.workId) ?? null;
    const group = groupFor(summary, entry);
    const listed = (entry?.shelves ?? []).filter((slug) => shelfSlugs.has(slug));
    const work: LibraryWork = {
      workId: summary.workId,
      slug: entry?.slug ?? summary.slug,
      summary,
      entry,
      groupKey: group.key,
      shelves: listed.length > 0 ? listed : [OTHER_SHELF],
      kind: entry?.kind ?? null,
      year: summary.year,
      century: centuryOfWork(summary.year, entry?.centuryOverride, group.born, group.died),
    };
    group.workIds.push(work.workId);
    return work;
  });

  // The default order: the editorial "start here" list first, then oldest to newest.
  const curated = new Map((catalogue?.startHere ?? []).map((slug, index) => [slug, index]));
  const ordered = works
    .map((work, index) => ({ work, index }))
    .sort((a, b) => {
      const left = curated.get(a.work.slug);
      const right = curated.get(b.work.slug);
      if (left !== undefined || right !== undefined) {
        if (left === undefined) return 1;
        if (right === undefined) return -1;
        return left - right;
      }
      return compareWorks(a.work, b.work) || a.index - b.index;
    })
    .map(({ work }) => work);

  const workById = new Map(ordered.map((work) => [work.workId, work]));
  const sortedGroups = [...groups.values()].sort(compareSortKeys);
  const groupByKey = new Map(sortedGroups.map((group) => [group.key, group]));
  for (const group of sortedGroups) {
    group.workIds = group.workIds
      .map((id) => workById.get(id))
      .filter((work): work is LibraryWork => work !== undefined)
      .sort(compareWorks)
      .map((work) => work.workId);
  }

  const shelves = buildShelves(catalogue, ordered, groupByKey, language);

  const centuryCounts = new Map<number, number>();
  let undated = 0;
  for (const work of ordered) {
    if (work.century === null) undated += 1;
    else centuryCounts.set(work.century, (centuryCounts.get(work.century) ?? 0) + 1);
  }
  const centuries = [...centuryCounts]
    .map(([century, count]) => ({ century, count }))
    .sort((a, b) => a.century - b.century);

  const languages = new Set<string>();
  let editions = 0;
  for (const { summary } of ordered) {
    editions += summary.editions.length;
    for (const edition of summary.editions) languages.add(baseLanguage(edition.language));
  }

  return {
    catalogue,
    works: ordered,
    shelves,
    groups: sortedGroups,
    centuries,
    undated,
    totals: {
      works: ordered.length,
      editions,
      languages: [...languages].sort(),
      authors: sortedGroups.filter((group) => group.kind !== 'body').length,
    },
    workById,
    groupByKey,
  };
}

function buildShelves(
  catalogue: Catalogue | null,
  works: readonly LibraryWork[],
  groups: ReadonlyMap<string, LibraryGroup>,
  language: ReadingLanguage,
): LibraryShelf[] {
  const byShelf = new Map<string, LibraryWork[]>();
  for (const work of works) {
    for (const slug of work.shelves) byShelf.set(slug, [...(byShelf.get(slug) ?? []), work]);
  }
  const make = (
    shelf: Omit<LibraryShelf, 'workIds' | 'who'>,
    onShelf: readonly LibraryWork[],
  ): LibraryShelf => {
    const seen = new Set<string>();
    const who: string[] = [];
    const filed = onShelf
      .map((work) => groups.get(work.groupKey))
      .filter((group): group is LibraryGroup => group !== undefined)
      .sort(compareSortKeys);
    for (const group of filed) {
      if (seen.has(group.key)) continue;
      seen.add(group.key);
      who.push(group.kind === 'author' ? surnameOf(group.sortName) : groupName(group, language));
      if (who.length === 5) break;
    }
    return { ...shelf, workIds: onShelf.map((work) => work.workId), who };
  };
  const listed = [...(catalogue?.shelves ?? [])]
    .sort((a, b) => a.order - b.order || (a.slug < b.slug ? -1 : 1))
    .flatMap((shelf) => {
      const onShelf = byShelf.get(shelf.slug) ?? [];
      return onShelf.length === 0 ? [] : [make(shelf, onShelf)];
    });
  const rest = byShelf.get(OTHER_SHELF) ?? [];
  if (rest.length > 0) {
    listed.push(
      make(
        {
          slug: OTHER_SHELF,
          order: Number.MAX_SAFE_INTEGER,
          labelRo: OTHER_LABELS.ro,
          labelEn: OTHER_LABELS.en,
          descRo: '',
          descEn: '',
        },
        rest,
      ),
    );
  }
  return listed;
}

export function shelfLabel(shelf: LibraryShelf, language: ReadingLanguage): string {
  return language === 'ro' ? shelf.labelRo : shelf.labelEn;
}

export function shelfDescription(shelf: LibraryShelf, language: ReadingLanguage): string {
  return language === 'ro' ? shelf.descRo : shelf.descEn;
}

// --- the query: filters, URL state --------------------------------------------------------------

export type LibraryView = 'author' | 'century';
export type Availability = 'ro' | 'en' | 'partial';

/** Everything the "Toată biblioteca" page can be told; the whole state lives in the URL (4.4). */
export interface LibraryQuery {
  q: string;
  shelf: string | null;
  century: number | null;
  tradition: string | null;
  /** The language of the original (a base code: "la", "en", "grc"). */
  lang: string | null;
  availability: Availability | null;
  /** A to Z or "#". */
  letter: string | null;
  view: LibraryView;
  page: number;
}

export const EMPTY_QUERY: LibraryQuery = {
  q: '',
  shelf: null,
  century: null,
  tradition: null,
  lang: null,
  availability: null,
  letter: null,
  view: 'author',
  page: 1,
};

/** Authors per page of the list; a pager shows only above this many (6.2). */
export const PAGE_SIZE = 100;
/** The number of authors up to which every accordion starts open (6.2). */
export const OPEN_ALL_UP_TO = 12;

export type QueryParams = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the URL parameters leniently: whatever is not valid is the default. */
export function parseLibraryQuery(params: QueryParams): LibraryQuery {
  const slug = (value: string | undefined) =>
    value !== undefined && SLUG.test(value) ? value : null;
  const century = Number(single(params.century));
  const page = Number(single(params.page));
  const lang = single(params.lang)?.toLowerCase();
  const availability = single(params.avail);
  const letter = single(params.letter)?.toUpperCase();
  return {
    q: (single(params.q) ?? '').trim(),
    shelf: slug(single(params.shelf)),
    century: Number.isInteger(century) && century !== 0 && Math.abs(century) <= 60 ? century : null,
    tradition: slug(single(params.tradition)),
    lang: lang !== undefined && /^[a-z]{2,3}$/.test(lang) ? lang : null,
    availability:
      availability === 'ro' || availability === 'en' || availability === 'partial'
        ? availability
        : null,
    letter: letter !== undefined && /^[A-Z#]$/.test(letter) ? letter : null,
    view: single(params.view) === 'century' ? 'century' : 'author',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** The URL parameters of a query: a default value is never written (4.4). */
export function libraryParams(query: LibraryQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.q !== '') params.q = query.q;
  if (query.shelf !== null) params.shelf = query.shelf;
  if (query.century !== null) params.century = String(query.century);
  if (query.tradition !== null) params.tradition = query.tradition;
  if (query.lang !== null) params.lang = query.lang;
  if (query.availability !== null) params.avail = query.availability;
  if (query.letter !== null) params.letter = query.letter;
  if (query.view !== 'author') params.view = query.view;
  if (query.page > 1) params.page = String(query.page);
  return params;
}

const FILTER_KEYS = ['q', 'shelf', 'century', 'tradition', 'lang', 'availability'] as const;

/**
 * The query after a change: any filter that changes resets the letter and the page, and choosing a
 * letter resets the page (docs/ui-spec-v2.md, 6.2).
 */
export function updateQuery(query: LibraryQuery, patch: Partial<LibraryQuery>): LibraryQuery {
  const next: LibraryQuery = { ...query, ...patch };
  const filterChanged = FILTER_KEYS.some((key) => key in patch && patch[key] !== query[key]);
  if (filterChanged && !('letter' in patch)) next.letter = null;
  if ((filterChanged || 'letter' in patch) && !('page' in patch)) next.page = 1;
  return next;
}

/** True when anything but the view and the page narrows the list. */
export function isFiltered(query: LibraryQuery): boolean {
  return (
    query.q !== '' ||
    query.shelf !== null ||
    query.century !== null ||
    query.tradition !== null ||
    query.lang !== null ||
    query.availability !== null ||
    query.letter !== null
  );
}

// --- search by name -----------------------------------------------------------------------------

/**
 * How well a work answers a name search (6.5): 0 when the name of its author (or issuing body)
 * matches, 1 when its title (in any language) does, 2 when its meta line does (year, language of the
 * original, kind, shelf); null when nothing does. Accents and case are folded, as everywhere.
 */
export type NameRank = 0 | 1 | 2;

function includesFolded(haystacks: readonly (string | undefined)[], needle: string): boolean {
  return haystacks.some((text) => text !== undefined && foldText(text).includes(needle));
}

export function rankWork(model: LibraryModel, work: LibraryWork, text: string): NameRank | null {
  const needle = foldText(text.trim());
  if (needle === '') return 0;
  const group = model.groupByKey.get(work.groupKey);
  if (
    group &&
    includesFolded([group.nameRo, group.nameEn, group.nameOrig, group.sortName], needle)
  ) {
    return 0;
  }
  const { summary } = work;
  if (includesFolded([summary.titleRo, summary.titleEn, summary.titleOrig], needle)) return 1;
  const shelves = work.shelves.flatMap((slug) => {
    const shelf = model.shelves.find((candidate) => candidate.slug === slug);
    return shelf ? [shelf.labelRo, shelf.labelEn] : [];
  });
  const meta = [
    work.year === null ? undefined : String(work.year),
    summary.languageOrig,
    work.kind ?? undefined,
    ...shelves,
  ];
  return includesFolded(meta, needle) ? 2 : null;
}

/** The groups whose own name matches the text (what a name search lists as "Autori"). */
export function matchingGroups(model: LibraryModel, text: string): LibraryGroup[] {
  const needle = foldText(text.trim());
  if (needle === '') return [];
  return model.groups.filter(
    (group) =>
      group.workIds.length > 0 &&
      includesFolded([group.nameRo, group.nameEn, group.nameOrig, group.sortName], needle),
  );
}

// --- filtering, grouping, letters ---------------------------------------------------------------

function traditionMatches(model: LibraryModel, work: LibraryWork, wanted: string): boolean {
  const own = model.groupByKey.get(work.groupKey)?.tradition ?? null;
  if (own === null) return false;
  const parents = new Map((model.catalogue?.traditions ?? []).map((t) => [t.slug, t.parent]));
  for (
    let slug: string | undefined = own, steps = 0;
    slug !== undefined && steps < 10;
    steps += 1
  ) {
    if (slug === wanted) return true;
    slug = parents.get(slug);
  }
  return false;
}

/**
 * The works that pass every filter except the letter and the page (the A-Z bar counts what the
 * other filters leave). Ranked by how well they answer the name search, then in the model's order.
 */
export function filterWorks(model: LibraryModel, query: LibraryQuery): LibraryWork[] {
  const ranked: { work: LibraryWork; rank: number; index: number }[] = [];
  model.works.forEach((work, index) => {
    if (query.shelf !== null && !work.shelves.includes(query.shelf)) return;
    if (query.century !== null && work.century !== query.century) return;
    if (query.tradition !== null && !traditionMatches(model, work, query.tradition)) return;
    if (query.lang !== null && baseLanguage(work.summary.languageOrig) !== query.lang) return;
    if (query.availability !== null) {
      const { editions } = work.summary;
      const has =
        query.availability === 'partial'
          ? editions.some((edition) => isPartialEdition(edition, editions))
          : editions.some((edition) => baseLanguage(edition.language) === query.availability);
      if (!has) return;
    }
    const rank = query.q === '' ? 0 : rankWork(model, work, query.q);
    if (rank === null) return;
    ranked.push({ work, rank, index });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map(({ work }) => work);
}

/** One entry of the A-Z bar: a letter and how many groups (authors) have it. */
export interface LetterCount {
  letter: string;
  count: number;
}

export interface GroupResult {
  group: LibraryGroup;
  works: LibraryWork[];
}

/** The works grouped by who they are filed under, groups in sort order, works oldest first. */
export function groupResults(model: LibraryModel, works: readonly LibraryWork[]): GroupResult[] {
  const byGroup = new Map<string, LibraryWork[]>();
  for (const work of works)
    byGroup.set(work.groupKey, [...(byGroup.get(work.groupKey) ?? []), work]);
  const results: GroupResult[] = [];
  for (const group of model.groups) {
    const own = byGroup.get(group.key);
    if (!own) continue;
    // Keep the group's own order (oldest first), not the rank order of the search.
    const order = new Map(group.workIds.map((id, index) => [id, index]));
    results.push({
      group,
      works: [...own].sort((a, b) => (order.get(a.workId) ?? 0) - (order.get(b.workId) ?? 0)),
    });
  }
  return results;
}

/** The letters that have groups in the results, A to Z first and "#" last, with their counts. */
export function lettersOf(results: readonly GroupResult[]): LetterCount[] {
  const counts = new Map<string, number>();
  for (const { group } of results) counts.set(group.letter, (counts.get(group.letter) ?? 0) + 1);
  return [...counts]
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => (a.letter === '#' ? 1 : b.letter === '#' ? -1 : a.letter < b.letter ? -1 : 1));
}

/** The shape of one rendered page of the list. */
export interface LibraryPage {
  /** Every group with a work in the results, before the letter and the page narrow them. */
  all: GroupResult[];
  letters: LetterCount[];
  /** After the letter filter. */
  shown: GroupResult[];
  /** The groups on the current page. */
  page: GroupResult[];
  pageNumber: number;
  pageCount: number;
  /** The works that the letter leaves (the count line counts works, not authors). */
  workCount: number;
}

/** Applies the filters, the letter and the page to the model. */
export function libraryPage(model: LibraryModel, query: LibraryQuery): LibraryPage {
  const all = groupResults(model, filterWorks(model, query));
  const letters = lettersOf(all);
  const shown =
    query.letter === null ? all : all.filter(({ group }) => group.letter === query.letter);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageNumber = Math.min(query.page, pageCount);
  return {
    all,
    letters,
    shown,
    page: shown.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE),
    pageNumber,
    pageCount,
    workCount: shown.reduce((sum, result) => sum + result.works.length, 0),
  };
}

/** The titles of a work in the reading language and, when it differs, the original. */
export function titlesOf(work: LibraryWork, language: ReadingLanguage): string {
  return workTitle(work.summary, language);
}
