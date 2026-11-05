import type { Catalogue, CatalogueAuthor, CatalogueWork, Pack, WorkKind } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';

import type { BundledCatalogue } from '@/catalogue/bundled-catalogue';
import { loadBundledCatalogue } from '@/catalogue/verify-catalogue';
import type { BundledPack } from '@/content/bundled-packs';
import { loadBundledRepository } from '@/content/repository';
import type { LoadedRepository } from '@/content/repository';
import { trustedKeys } from '@/content/trusted-keys';
import type { TrustedKey } from '@/content/verify-pack';

import { signCatalogue } from './catalogue';
import { createTestSigner, signPack } from './packs';
import type { TestSigner } from './packs';

// F-2 of docs/ui-spec-v2.md 20.1: a synthetic library of fifteen authors on six shelves, centuries 5
// to 20, and one work without an author that has an issuing body (a council), signed with a test
// key. Titles are made up from real names so that the screens read like the real thing.

interface Person {
  slug: string;
  nameRo: string;
  nameEn: string;
  nameOrig: string;
  sortName: string;
  born: number;
  died: number;
}

const PEOPLE: readonly Person[] = [
  {
    slug: 'augustin',
    nameRo: 'Augustin',
    nameEn: 'Augustine',
    nameOrig: 'Aurelius Augustinus',
    sortName: 'Augustin',
    born: 354,
    died: 430,
  },
  {
    slug: 'ioan-gura-de-aur',
    nameRo: 'Ioan Gură de Aur',
    nameEn: 'John Chrysostom',
    nameOrig: 'Ioannes Chrysostomos',
    sortName: 'Ioan Gură de Aur',
    born: 347,
    died: 407,
  },
  {
    slug: 'grigorie-cel-mare',
    nameRo: 'Grigorie cel Mare',
    nameEn: 'Gregory the Great',
    nameOrig: 'Gregorius Magnus',
    sortName: 'Grigorie cel Mare',
    born: 540,
    died: 604,
  },
  {
    slug: 'ioan-damaschin',
    nameRo: 'Ioan Damaschin',
    nameEn: 'John of Damascus',
    nameOrig: 'Ioannes Damaskenos',
    sortName: 'Ioan Damaschin',
    born: 675,
    died: 749,
  },
  {
    slug: 'anselm',
    nameRo: 'Anselm de Canterbury',
    nameEn: 'Anselm of Canterbury',
    nameOrig: 'Anselmus Cantuariensis',
    sortName: 'Anselm',
    born: 1033,
    died: 1109,
  },
  {
    slug: 'bernard',
    nameRo: 'Bernard de Clairvaux',
    nameEn: 'Bernard of Clairvaux',
    nameOrig: 'Bernardus Claraevallensis',
    sortName: 'Bernard de Clairvaux',
    born: 1090,
    died: 1153,
  },
  {
    slug: 'toma-d-aquino',
    nameRo: 'Toma d’Aquino',
    nameEn: 'Thomas Aquinas',
    nameOrig: 'Thomas de Aquino',
    sortName: 'Toma d’Aquino',
    born: 1225,
    died: 1274,
  },
  {
    slug: 'toma-kempis',
    nameRo: 'Toma Kempis',
    nameEn: 'Thomas à Kempis',
    nameOrig: 'Thomas Hemerken a Kempis',
    sortName: 'Kempis, Toma',
    born: 1380,
    died: 1471,
  },
  {
    slug: 'martin-luther',
    nameRo: 'Martin Luther',
    nameEn: 'Martin Luther',
    nameOrig: 'Martin Luther',
    sortName: 'Luther, Martin',
    born: 1483,
    died: 1546,
  },
  {
    slug: 'ioan-calvin',
    nameRo: 'Ioan Calvin',
    nameEn: 'John Calvin',
    nameOrig: 'Ioannes Calvinus',
    sortName: 'Calvin, Ioan',
    born: 1509,
    died: 1564,
  },
  {
    slug: 'richard-baxter',
    nameRo: 'Richard Baxter',
    nameEn: 'Richard Baxter',
    nameOrig: 'Richard Baxter',
    sortName: 'Baxter, Richard',
    born: 1615,
    died: 1691,
  },
  {
    slug: 'john-owen',
    nameRo: 'John Owen',
    nameEn: 'John Owen',
    nameOrig: 'John Owen',
    sortName: 'Owen, John',
    born: 1616,
    died: 1683,
  },
  {
    slug: 'jonathan-edwards',
    nameRo: 'Jonathan Edwards',
    nameEn: 'Jonathan Edwards',
    nameOrig: 'Jonathan Edwards',
    sortName: 'Edwards, Jonathan',
    born: 1703,
    died: 1758,
  },
  {
    slug: 'charles-hodge',
    nameRo: 'Charles Hodge',
    nameEn: 'Charles Hodge',
    nameOrig: 'Charles Hodge',
    sortName: 'Hodge, Charles',
    born: 1797,
    died: 1878,
  },
  {
    slug: 'geerhardus-vos',
    nameRo: 'Geerhardus Vos',
    nameEn: 'Geerhardus Vos',
    nameOrig: 'Geerhardus Vos',
    sortName: 'Vos, Geerhardus',
    born: 1862,
    died: 1949,
  },
];

interface Piece {
  slug: string;
  /** The person's slug, or null for a work of an issuing body. */
  by: string | null;
  year: number;
  /** Language of the original. */
  lang: string;
  titleRo: string;
  titleEn: string;
  titleOrig: string;
  shelf: string;
  kind: WorkKind;
  /** The translations installed next to the source edition. */
  translations: readonly ('ro' | 'en')[];
}

const PIECES: readonly Piece[] = [
  {
    slug: 'despre-spirit-si-litera',
    by: 'augustin',
    year: 412,
    lang: 'la',
    titleRo: 'Despre spirit și literă',
    titleEn: 'On the Spirit and the Letter',
    titleOrig: 'De spiritu et littera',
    shelf: 'fathers',
    kind: 'treatise',
    translations: ['ro', 'en'],
  },
  {
    slug: 'omilii-la-matei',
    by: 'ioan-gura-de-aur',
    year: 401,
    lang: 'grc',
    titleRo: 'Omilii la Matei',
    titleEn: 'Homilies on Matthew',
    titleOrig: 'Eis to kata Maththaion',
    shelf: 'fathers',
    kind: 'sermons',
    translations: ['en'],
  },
  {
    slug: 'regula-pastorala',
    by: 'grigorie-cel-mare',
    year: 591,
    lang: 'la',
    titleRo: 'Regula pastorală',
    titleEn: 'The Pastoral Rule',
    titleOrig: 'Regula pastoralis',
    shelf: 'fathers',
    kind: 'treatise',
    translations: ['ro'],
  },
  {
    slug: 'expunerea-credintei',
    by: 'ioan-damaschin',
    year: 743,
    lang: 'grc',
    titleRo: 'Expunerea exactă a credinței ortodoxe',
    titleEn: 'An Exposition of the Orthodox Faith',
    titleOrig: 'Ekdosis akribes',
    shelf: 'fathers',
    kind: 'treatise',
    translations: ['en', 'ro'],
  },
  {
    slug: 'cur-deus-homo',
    by: 'anselm',
    year: 1098,
    lang: 'la',
    titleRo: 'De ce S-a făcut Dumnezeu om',
    titleEn: 'Why God Became Man',
    titleOrig: 'Cur Deus homo',
    shelf: 'medieval',
    kind: 'dialogue',
    translations: ['en'],
  },
  {
    slug: 'despre-iubirea-de-dumnezeu',
    by: 'bernard',
    year: 1126,
    lang: 'la',
    titleRo: 'Despre iubirea de Dumnezeu',
    titleEn: 'On Loving God',
    titleOrig: 'De diligendo Deo',
    shelf: 'medieval',
    kind: 'treatise',
    translations: ['ro'],
  },
  {
    slug: 'summa-theologiae',
    by: 'toma-d-aquino',
    year: 1265,
    lang: 'la',
    titleRo: 'Suma teologică',
    titleEn: 'Summa Theologiae',
    titleOrig: 'Summa theologiae',
    shelf: 'medieval',
    kind: 'treatise',
    translations: ['en'],
  },
  {
    slug: 'imitarea-lui-hristos',
    by: 'toma-kempis',
    year: 1418,
    lang: 'la',
    titleRo: 'Imitarea lui Hristos',
    titleEn: 'The Imitation of Christ',
    titleOrig: 'De imitatione Christi',
    shelf: 'medieval',
    kind: 'devotional',
    translations: ['ro', 'en'],
  },
  {
    slug: 'libertatea-crestinului',
    by: 'martin-luther',
    year: 1520,
    lang: 'de',
    titleRo: 'Despre libertatea creștinului',
    titleEn: 'On the Freedom of a Christian',
    titleOrig: 'Von der Freiheit eines Christenmenschen',
    shelf: 'reformation',
    kind: 'treatise',
    translations: ['en'],
  },
  {
    slug: 'institutio',
    by: 'ioan-calvin',
    year: 1559,
    lang: 'la',
    titleRo: 'Așezământul religiei creștine',
    titleEn: 'Institutes of the Christian Religion',
    titleOrig: 'Institutio Christianae religionis',
    shelf: 'reformation',
    kind: 'treatise',
    translations: ['en'],
  },
  {
    slug: 'pastorul-reformat',
    by: 'richard-baxter',
    year: 1656,
    lang: 'en',
    titleRo: 'Pastorul reformat',
    titleEn: 'The Reformed Pastor',
    titleOrig: 'The Reformed Pastor',
    shelf: 'puritans',
    kind: 'treatise',
    translations: ['ro'],
  },
  {
    slug: 'omorarea-pacatului',
    by: 'john-owen',
    year: 1656,
    lang: 'en',
    titleRo: 'Omorârea păcatului',
    titleEn: 'The Mortification of Sin',
    titleOrig: 'Of the Mortification of Sin in Believers',
    shelf: 'puritans',
    kind: 'treatise',
    translations: [],
  },
  {
    slug: 'afectiunile-religioase',
    by: 'jonathan-edwards',
    year: 1746,
    lang: 'en',
    titleRo: 'Afecțiunile religioase',
    titleEn: 'Religious Affections',
    titleOrig: 'A Treatise Concerning Religious Affections',
    shelf: 'puritans',
    kind: 'treatise',
    translations: [],
  },
  {
    slug: 'teologie-sistematica',
    by: 'charles-hodge',
    year: 1872,
    lang: 'en',
    titleRo: 'Teologie sistematică',
    titleEn: 'Systematic Theology',
    titleOrig: 'Systematic Theology',
    shelf: 'modern',
    kind: 'treatise',
    translations: [],
  },
  {
    slug: 'invatatura-lui-isus',
    by: 'geerhardus-vos',
    year: 1903,
    lang: 'en',
    titleRo: 'Învățătura lui Isus despre Împărăția lui Dumnezeu',
    titleEn: 'The Teaching of Jesus Concerning the Kingdom of God',
    titleOrig: 'The Teaching of Jesus Concerning the Kingdom of God',
    shelf: 'modern',
    kind: 'treatise',
    translations: ['ro'],
  },
  {
    slug: 'definitia-de-la-calcedon',
    by: null,
    year: 451,
    lang: 'grc',
    titleRo: 'Definiția de la Calcedon',
    titleEn: 'The Definition of Chalcedon',
    titleOrig: 'Horos tes en Chalkedoni',
    shelf: 'creeds',
    kind: 'creed',
    translations: ['en', 'ro'],
  },
];

const SHELVES = [
  ['creeds', 'Crezuri, mărturisiri și catehisme', 'Creeds, confessions and catechisms'],
  ['fathers', 'Părinții Bisericii', 'Church Fathers'],
  ['medieval', 'Evul Mediu', 'The Middle Ages'],
  ['reformation', 'Reforma', 'The Reformation'],
  ['puritans', 'Puritani și teologi englezi', 'Puritans and English divines'],
  ['modern', 'Teologie modernă', 'Modern theology'],
] as const;

const COUNCIL = {
  slug: 'conciliul-din-calcedon',
  labelRo: 'Conciliul din Calcedon',
  labelEn: 'Council of Chalcedon',
  year: 451,
} as const;

export interface SyntheticLibrary {
  signer: TestSigner;
  /** The unsigned catalogue, for tests that sign a changed copy. */
  catalogue: Catalogue;
  /** The signed catalogue as the app would bundle it. */
  bundledCatalogue: BundledCatalogue;
  packs: BundledPack[];
  /** The pinned keys and the test key, for `loadBundledRepository` and `loadBundledCatalogue`. */
  trustedKeys: TrustedKey[];
  /** The ids of the works, by slug. */
  workIds: Record<string, string>;
  /** Verifies the catalogue and loads the repository over the packs, as the app does. */
  load(): Promise<LoadedRepository>;
}

function packFor(
  piece: Piece,
  work: Pack['work'],
  edition: 'source' | 'ro' | 'en',
  sourceId?: string,
): Pack {
  const sectionId = stableId();
  const language = edition === 'source' ? piece.lang : edition;
  return {
    work,
    edition: {
      id: stableId(),
      language,
      kind: edition === 'source' ? 'source' : 'translation',
      licence: { status: 'public-domain', note: 'Synthetic.' },
      provenance: { source: 'fixture', extractedBy: 'fixture', notes: '' },
      ...(sourceId === undefined ? null : { sourceEditionId: sourceId }),
    },
    sections: [{ id: sectionId, ordinal: 0, kind: 'chapter', heading: 'I' }],
    paragraphs: [0, 1].map((ordinal) => ({
      id: stableId(),
      sectionId,
      ordinal,
      kind: 'p' as const,
      text: `Fragment ${ordinal + 1} din ${piece.titleEn}: harul lui Dumnezeu.`,
    })),
  };
}

/** Builds F-2: the catalogue, its packs and a loader, all signed with one throwaway test key. */
export function syntheticLibrary(options: { without?: readonly string[] } = {}): SyntheticLibrary {
  const signer = createTestSigner('f2-key');
  const trusted = [...trustedKeys, signer.key];
  const authors: CatalogueAuthor[] = PEOPLE.map((person) => ({
    ...person,
    tradition: 'church',
    bioRo: `Biografia lui ${person.nameRo}.`,
    bioEn: `The biography of ${person.nameEn}.`,
    bioKind: 'editorial',
  }));
  const works: CatalogueWork[] = [];
  const packs: BundledPack[] = [];
  const workIds: Record<string, string> = {};
  const catalogueWorks: CatalogueWork[] = [];
  const packEntries: { packId: string; editionId: string; sha256: string; size: number }[] = [];

  for (const piece of PIECES) {
    if (options.without?.includes(piece.slug)) continue;
    const person = PEOPLE.find((candidate) => candidate.slug === piece.by);
    const work: Pack['work'] = {
      id: stableId(),
      slug: piece.slug,
      titleRo: piece.titleRo,
      titleEn: piece.titleEn,
      titleOrig: piece.titleOrig,
      author: person
        ? { name: person.nameEn, born: person.born, died: person.died, tradition: 'church' }
        : { name: COUNCIL.labelEn, born: null, died: null, tradition: 'church' },
      languageOrig: piece.lang,
      year: piece.year,
    };
    workIds[piece.slug] = work.id;
    const source = packFor(piece, work, 'source');
    const built = [
      signPack(source, signer, { packId: `${piece.slug}-${piece.lang}` }),
      ...piece.translations.map((language) =>
        signPack(packFor(piece, work, language, source.edition.id), signer, {
          packId: `${piece.slug}-${language}`,
        }),
      ),
    ];
    for (const pack of built) {
      packs.push(pack);
      const manifest = pack.manifest as {
        packId: string;
        editionId: string;
        sha256: string;
        size: number;
      };
      packEntries.push({
        packId: manifest.packId,
        editionId: manifest.editionId,
        sha256: manifest.sha256,
        size: manifest.size,
      });
    }
    catalogueWorks.push({
      workId: work.id,
      slug: piece.slug,
      ...(piece.by === null ? { issuingBody: COUNCIL } : { authorSlug: piece.by }),
      shelves: [piece.shelf],
      kind: piece.kind,
      blurbRo: `Despre ${piece.titleRo}.`,
      blurbEn: `About ${piece.titleEn}.`,
      blurbKind: 'editorial',
      start: [],
    });
  }
  works.push(...catalogueWorks);

  const catalogue: Catalogue = {
    shelves: SHELVES.map(([slug, labelRo, labelEn], index) => ({
      slug,
      order: index + 1,
      labelRo,
      labelEn,
      descRo: `Descrierea raftului ${labelRo}.`,
      descEn: `The description of the ${labelEn} shelf.`,
    })),
    authors,
    works,
    packs: packEntries.sort((a, b) => (a.packId < b.packId ? -1 : 1)),
  };
  const bundled = signCatalogue(catalogue, signer);
  return {
    signer,
    catalogue,
    bundledCatalogue: bundled,
    packs,
    trustedKeys: trusted,
    workIds,
    async load() {
      const state = await loadBundledCatalogue({ bundled, trustedKeys: trusted });
      return loadBundledRepository({ packs, trustedKeys: trusted, catalogue: state });
    },
  };
}

/** The number of authors in F-2 (the anonymous work has an issuing body, not an author). */
export const F2_AUTHORS = PEOPLE.length;
