import { loadBundledCatalogue } from '@/catalogue/verify-catalogue';
import { loadBundledRepository } from '@/content/repository';
import type { WorkSummary } from '@/content/types';
import {
  EMPTY_QUERY,
  OPEN_ALL_UP_TO,
  OTHER_SHELF,
  PAGE_SIZE,
  buildLibraryModel,
  centuryOfWork,
  compareSortKeys,
  filterWorks,
  groupName,
  letterOf,
  libraryPage,
  libraryParams,
  matchingGroups,
  parseLibraryQuery,
  rankWork,
  shelfLabel,
  surnameOf,
} from '@/library/model';
import { foldText } from '@/search/fold';
import { F2_AUTHORS, syntheticLibrary } from '@/test-support/library-fixtures';

const f2 = async (language: 'ro' | 'en' = 'ro') => {
  const library = syntheticLibrary();
  const loaded = await library.load();
  const works = await loaded.repository.listWorks(language);
  const catalogue = loaded.catalogue.status === 'verified' ? loaded.catalogue.catalogue : null;
  return { library, works, catalogue, model: buildLibraryModel(works, catalogue, language) };
};

/** A work summary made up from a name and a year, for the cases the fixture does not cover. */
function summary(index: number, overrides: Partial<WorkSummary> = {}): WorkSummary {
  return {
    workId: `w${index}`,
    slug: `lucrare-${index}`,
    titleRo: `Lucrarea ${index}`,
    titleOrig: `Work ${index}`,
    authorName: `Autor ${String(index).padStart(3, '0')}`,
    authorBorn: null,
    authorDied: null,
    year: 1500,
    languageOrig: 'en',
    editions: [],
    primaryEditionId: `e${index}`,
    ...overrides,
  };
}

describe('the model of the installed Vos packs and the bundled catalogue', () => {
  it('has one work, one author, one shelf, one century and counts that agree', async () => {
    const catalogueState = await loadBundledCatalogue();
    const { repository } = await loadBundledRepository({ catalogue: catalogueState });
    const works = await repository.listWorks('ro');
    const catalogue = catalogueState.status === 'verified' ? catalogueState.catalogue : null;
    const model = buildLibraryModel(works, catalogue, 'ro');
    expect(model.works).toHaveLength(1);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0]).toMatchObject({ kind: 'author', slug: 'geerhardus-vos', letter: 'V' });
    expect(model.shelves.map((shelf) => [shelf.slug, shelf.workIds.length, shelf.who])).toEqual([
      ['modern', 1, ['Vos']],
    ]);
    expect(model.centuries).toEqual([{ century: 20, count: 1 }]);
    expect(model.undated).toBe(0);
    expect(model.totals).toEqual({ works: 1, editions: 2, languages: ['en', 'ro'], authors: 1 });
    expect(model.works[0]).toMatchObject({ kind: 'treatise', century: 20, shelves: ['modern'] });
    expect(model.works[0]!.entry?.blurbEn).toMatch(/kingdom/);
  });

  it('lists every work under "Altele", without a blurb or a kind, when there is no catalogue (a tampered one is not read)', async () => {
    const { repository } = await loadBundledRepository();
    const works = await repository.listWorks('ro');
    const model = buildLibraryModel(works, null, 'ro');
    expect(model.works).toHaveLength(1);
    expect(model.works[0]).toMatchObject({ entry: null, kind: null, shelves: [OTHER_SHELF], century: 20 });
    expect(model.shelves).toHaveLength(1);
    expect(model.shelves[0]).toMatchObject({ slug: OTHER_SHELF, labelRo: 'Altele', labelEn: 'Other' });
    expect(model.groups[0]).toMatchObject({ kind: 'name', slug: null, nameRo: 'Geerhardus Vos' });
    expect(model.totals.works).toBe(1);
  });

  it('files a work that has no entry under the catalogue author of the same name', async () => {
    const catalogueState = await loadBundledCatalogue();
    if (catalogueState.status !== 'verified') throw new Error('the bundled catalogue must verify');
    const { repository } = await loadBundledRepository({ catalogue: catalogueState });
    const works = await repository.listWorks('ro');
    const withoutEntry = { ...catalogueState.catalogue, works: [] };
    const model = buildLibraryModel(works, withoutEntry, 'ro');
    expect(model.groups.map((group) => [group.kind, group.slug])).toEqual([['author', 'geerhardus-vos']]);
    expect(model.works[0]).toMatchObject({ entry: null, shelves: [OTHER_SHELF] });
  });
});

describe('the model of F-2 (fifteen authors, six shelves, an issuing body)', () => {
  it('derives the counts from the packs and the catalogue', async () => {
    const { model } = await f2();
    expect(model.totals.works).toBe(16);
    expect(model.totals.authors).toBe(F2_AUTHORS);
    expect(model.groups.filter((group) => group.kind === 'body')).toHaveLength(1);
    expect(model.groups.filter((group) => group.kind === 'author')).toHaveLength(15);
    expect(model.shelves.map((shelf) => [shelf.slug, shelf.workIds.length])).toEqual([
      ['creeds', 1],
      ['fathers', 4],
      ['medieval', 4],
      ['reformation', 2],
      ['puritans', 3],
      ['modern', 2],
    ]);
    expect(model.totals.languages).toEqual(['de', 'en', 'grc', 'la', 'ro']);
    // 16 sources and 17 translations.
    expect(model.totals.editions).toBe(16 + 17);
  });

  it('derives centuries as ceil(year / 100) and counts only the ones that have works', async () => {
    const { model } = await f2();
    expect(model.centuries).toEqual([
      { century: 5, count: 3 }, // 401, 412 and 451 (the council)
      { century: 6, count: 1 },
      { century: 8, count: 1 },
      { century: 11, count: 1 },
      { century: 12, count: 1 },
      { century: 13, count: 1 },
      { century: 15, count: 1 },
      { century: 16, count: 2 },
      { century: 17, count: 2 },
      { century: 18, count: 1 },
      { century: 19, count: 1 },
      { century: 20, count: 1 },
    ]);
    expect(model.undated).toBe(0);
  });

  it('files the work of an issuing body under the body, in the A-Z bar, the sort and the groups', async () => {
    const { model } = await f2('ro');
    const body = model.groups.find((group) => group.kind === 'body')!;
    expect(body).toMatchObject({ slug: 'conciliul-din-calcedon', year: 451, letter: 'C' });
    expect(groupName(body, 'ro')).toBe('Conciliul din Calcedon');
    expect(groupName(body, 'en')).toBe('Council of Chalcedon');
    expect(model.workById.get(body.workIds[0]!)?.groupKey).toBe(body.key);
    const page = libraryPage(model, EMPTY_QUERY);
    expect(page.letters.map((entry) => entry.letter)).toEqual(
      ['A', 'B', 'C', 'E', 'G', 'H', 'I', 'K', 'L', 'O', 'T', 'V'],
    );
  });

  it('sorts people under their sort name and counts authors, not works, per letter', async () => {
    const { model } = await f2();
    const page = libraryPage(model, EMPTY_QUERY);
    // Calvin and the council are under C; the three "Ioan ..." and "Grigorie" are not surnames.
    expect(Object.fromEntries(page.letters.map(({ letter, count }) => [letter, count]))).toEqual({
      A: 2, // Anselm, Augustin
      B: 2, // Baxter, Bernard de Clairvaux
      C: 2, // Calvin, the Council of Chalcedon
      E: 1,
      G: 1,
      H: 1,
      I: 2, // Ioan Damaschin, Ioan Gură de Aur
      K: 1,
      L: 1,
      O: 1,
      T: 1, // Toma d’Aquino
      V: 1,
    });
    expect(page.all).toHaveLength(16);
    expect(page.workCount).toBe(16);
    expect(page.pageCount).toBe(1);
    // Alphabetical by the folded sort name.
    const names = page.all.map(({ group }) => group.sortName);
    const folded = names.map(foldText);
    expect([...folded].sort()).toEqual(folded);
  });

  it('writes who is on a shelf as up to five surnames, alphabetically', async () => {
    const { model } = await f2();
    const who = Object.fromEntries(model.shelves.map((shelf) => [shelf.slug, shelf.who]));
    expect(who.modern).toEqual(['Hodge', 'Vos']);
    expect(who.reformation).toEqual(['Calvin', 'Luther']);
    expect(who.creeds).toEqual(['Conciliul din Calcedon']);
    expect(who.fathers).toEqual(['Augustin', 'Grigorie cel Mare', 'Ioan Damaschin', 'Ioan Gură de Aur']);
    const english = (await f2('en')).model;
    expect(english.shelves.find((shelf) => shelf.slug === 'creeds')!.who).toEqual(['Council of Chalcedon']);
    expect(shelfLabel(english.shelves[1]!, 'en')).toBe('Church Fathers');
    expect(shelfLabel(english.shelves[1]!, 'ro')).toBe('Părinții Bisericii');
  });

  it('never shows a shelf that holds no work', async () => {
    const library = syntheticLibrary({ without: ['definitia-de-la-calcedon'] });
    const loaded = await library.load();
    const catalogue = loaded.catalogue.status === 'verified' ? loaded.catalogue.catalogue : null;
    const model = buildLibraryModel(await loaded.repository.listWorks('ro'), catalogue, 'ro');
    expect(model.shelves.map((shelf) => shelf.slug)).not.toContain('creeds');
    expect(model.totals.works).toBe(15);
  });

  it('puts the editorial "start here" list first, then oldest to newest', async () => {
    const { library, works } = await f2();
    const withList = { ...library.catalogue, startHere: ['invatatura-lui-isus', 'institutio'] };
    const model = buildLibraryModel(works, withList, 'ro');
    expect(model.works.slice(0, 3).map((work) => work.slug)).toEqual([
      'invatatura-lui-isus',
      'institutio',
      'omilii-la-matei', // 401, the oldest
    ]);
  });
});

describe('centuries of a work (6.4)', () => {
  it('is ceil(year / 100); the editorial override wins; the author midpoint stands in for a missing year', () => {
    expect(centuryOfWork(1903, undefined, 1862, 1949)).toBe(20);
    expect(centuryOfWork(1900, undefined, null, null)).toBe(19);
    expect(centuryOfWork(1901, undefined, null, null)).toBe(20);
    expect(centuryOfWork(1903, 19, 1862, 1949)).toBe(19);
    expect(centuryOfWork(null, undefined, 354, 430)).toBe(4); // midpoint 392
    expect(centuryOfWork(null, undefined, null, 430)).toBe(5);
    expect(centuryOfWork(null, undefined, 354, null)).toBe(4);
    expect(centuryOfWork(null, undefined, null, null)).toBeNull();
    expect(centuryOfWork(-150, undefined, null, null)).toBe(-2);
  });

  it('counts a work with no date as undated, and draws no tile for it', () => {
    const model = buildLibraryModel([summary(1, { year: null }), summary(2, { year: 1650 })], null, 'ro');
    expect(model.undated).toBe(1);
    expect(model.centuries).toEqual([{ century: 17, count: 1 }]);
  });
});

describe('sorting and letters (17.5)', () => {
  it('files a name under the folded first letter: Ș and S share the entry S, anything else is #', () => {
    expect(letterOf(foldText('Ștefan'))).toBe('S');
    expect(letterOf(foldText('Școala din Sedan'))).toBe('S');
    expect(letterOf(foldText('Ținut'))).toBe('T');
    expect(letterOf(foldText('Árpád'))).toBe('A');
    expect(letterOf(foldText('Ἀθανάσιος'))).toBe('#');
    expect(letterOf(foldText('1 Clement'))).toBe('#');
    expect(letterOf('')).toBe('#');
  });

  it('sorts by the folded key first, and only then by the collator', () => {
    const a = { sortKey: foldText('Șerban'), sortName: 'Șerban' };
    const b = { sortKey: foldText('Sandu'), sortName: 'Sandu' };
    // "serban" sorts after "sandu" on the folded key, whatever the platform collation thinks of Ș.
    expect(compareSortKeys(a, b)).toBeGreaterThan(0);
    expect(compareSortKeys(b, a)).toBeLessThan(0);
    // Equal keys: the collator breaks the tie, and a name is never equal to a different one.
    const plain = { sortKey: 'a', sortName: 'a' };
    const accented = { sortKey: 'a', sortName: 'á' };
    expect(compareSortKeys(plain, accented)).not.toBe(0);
    expect(compareSortKeys(plain, plain)).toBe(0);
  });

  it('takes the surname of a sort name', () => {
    expect(surnameOf('Vos, Geerhardus')).toBe('Vos');
    expect(surnameOf('Augustin')).toBe('Augustin');
    expect(surnameOf(', x')).toBe(', x');
  });
});

describe('the query and the URL (4.4)', () => {
  it('writes only what differs from the defaults', () => {
    expect(libraryParams(EMPTY_QUERY)).toEqual({});
    expect(
      libraryParams({
        ...EMPTY_QUERY,
        q: 'vos',
        shelf: 'fathers',
        century: 20,
        lang: 'la',
        availability: 'partial',
        letter: 'V',
        view: 'century',
        page: 3,
      }),
    ).toEqual({
      q: 'vos',
      shelf: 'fathers',
      century: '20',
      lang: 'la',
      avail: 'partial',
      letter: 'V',
      view: 'century',
      page: '3',
    });
    expect(libraryParams({ ...EMPTY_QUERY, view: 'author', page: 1 })).toEqual({});
  });

  it('reads parameters back, and ignores what is not valid', () => {
    const written = {
      ...EMPTY_QUERY,
      q: 'vos',
      shelf: 'fathers',
      century: 20,
      tradition: 'reformed',
      lang: 'la',
      availability: 'ro' as const,
      letter: '#',
      view: 'century' as const,
      page: 2,
    };
    expect(parseLibraryQuery(libraryParams(written))).toEqual(written);
    expect(
      parseLibraryQuery({
        shelf: 'Not A Slug!',
        century: 'abc',
        lang: 'english',
        avail: 'greek',
        letter: 'ab',
        view: 'tiles',
        page: '-4',
        q: ['first', 'second'],
      }),
    ).toEqual({ ...EMPTY_QUERY, q: 'first' });
    expect(parseLibraryQuery({ century: '0' }).century).toBeNull();
    expect(parseLibraryQuery({ century: '-5' }).century).toBe(-5);
    expect(parseLibraryQuery({ letter: 'v' }).letter).toBe('V');
    expect(parseLibraryQuery({ lang: 'LA' }).lang).toBe('la');
  });
});

describe('filters and search by name (6.2, 6.5)', () => {
  it('filters by shelf, century, original language and availability', async () => {
    const { model } = await f2();
    const slugs = (query: Partial<typeof EMPTY_QUERY>) =>
      filterWorks(model, { ...EMPTY_QUERY, ...query }).map((work) => work.slug);
    expect(slugs({ shelf: 'modern' })).toEqual(['teologie-sistematica', 'invatatura-lui-isus']);
    expect(slugs({ century: 16 })).toEqual(['libertatea-crestinului', 'institutio']);
    expect(slugs({ shelf: 'fathers', century: 5 })).toEqual(['omilii-la-matei', 'despre-spirit-si-litera']);
    expect(slugs({ lang: 'de' })).toEqual(['libertatea-crestinului']);
    // Oldest first: 401, 451, 743.
    expect(slugs({ lang: 'grc' })).toEqual([
      'omilii-la-matei',
      'definitia-de-la-calcedon',
      'expunerea-credintei',
    ]);
    expect(slugs({ shelf: 'nowhere' })).toEqual([]);
    // Romanian translations: Augustine, Gregory, John of Damascus, Bernard, Kempis, Baxter, Vos, Chalcedon.
    expect(slugs({ availability: 'ro' })).toHaveLength(8);
    expect(slugs({ availability: 'en' }).length).toBeGreaterThan(8);
    expect(slugs({ availability: 'partial' })).toEqual([]);
  });

  it('knows a partial translation when the translation has fewer sections than its source', async () => {
    const { model, works } = await f2();
    expect(works.every((work) => work.editions.every((edition) => edition.sectionCount === 1))).toBe(true);
    expect(filterWorks(model, { ...EMPTY_QUERY, availability: 'partial' })).toEqual([]);
  });

  it('ranks authors first, then titles, then the meta line, and folds case and accents', async () => {
    const { model } = await f2();
    const work = (slug: string) => model.works.find((candidate) => candidate.slug === slug)!;
    expect(rankWork(model, work('invatatura-lui-isus'), 'vos')).toBe(0);
    expect(rankWork(model, work('invatatura-lui-isus'), 'GEERHARDUS')).toBe(0);
    expect(rankWork(model, work('invatatura-lui-isus'), 'impar')).toBe(1); // "Împărăția" in the title
    expect(rankWork(model, work('invatatura-lui-isus'), '1903')).toBe(2);
    expect(rankWork(model, work('invatatura-lui-isus'), 'teologie moderna')).toBe(2); // the shelf
    expect(rankWork(model, work('invatatura-lui-isus'), 'zzz')).toBeNull();
    expect(rankWork(model, work('invatatura-lui-isus'), '')).toBe(0);
    // A name that is a title word too: the author comes first.
    const hits = filterWorks(model, { ...EMPTY_QUERY, q: 'toma' }).map((entry) => entry.slug);
    expect(hits).toEqual(['summa-theologiae', 'imitarea-lui-hristos']);
  });

  it('lists the authors whose own name matches', async () => {
    const { model } = await f2();
    expect(matchingGroups(model, 'ioan').map((group) => group.slug)).toEqual([
      'ioan-calvin',
      'ioan-damaschin',
      'ioan-gura-de-aur',
    ]);
    expect(matchingGroups(model, '')).toEqual([]);
    expect(matchingGroups(model, 'zzz')).toEqual([]);
  });

  it('counts the letters of what the other filters leave, and the letter narrows the list', async () => {
    const { model } = await f2();
    const search = libraryPage(model, { ...EMPTY_QUERY, q: 'vos' });
    expect(search.letters).toEqual([{ letter: 'V', count: 1 }]);
    expect(search.workCount).toBe(1);
    const letterC = libraryPage(model, { ...EMPTY_QUERY, letter: 'C' });
    expect(letterC.shown.map(({ group }) => group.sortName)).toEqual(['Calvin, Ioan', 'Conciliul din Calcedon']);
    // The letters still list everything the other filters leave: the bar does not shrink to the letter.
    expect(letterC.letters).toHaveLength(12);
    expect(letterC.workCount).toBe(2);
  });

  it('opens every accordion up to twelve authors, and pages only above one hundred', async () => {
    const { model } = await f2();
    expect(libraryPage(model, EMPTY_QUERY).all.length).toBeGreaterThan(OPEN_ALL_UP_TO);
    expect(libraryPage(model, { ...EMPTY_QUERY, shelf: 'modern' }).all.length).toBeLessThanOrEqual(OPEN_ALL_UP_TO);

    const many = buildLibraryModel(
      Array.from({ length: 230 }, (_, index) => summary(index + 1)),
      null,
      'ro',
    );
    const first = libraryPage(many, EMPTY_QUERY);
    expect(PAGE_SIZE).toBe(100);
    expect(first.pageCount).toBe(3);
    expect(first.page).toHaveLength(100);
    expect(libraryPage(many, { ...EMPTY_QUERY, page: 3 }).page).toHaveLength(30);
    // A page past the end is the last page.
    expect(libraryPage(many, { ...EMPTY_QUERY, page: 9 }).pageNumber).toBe(3);
  });
});
