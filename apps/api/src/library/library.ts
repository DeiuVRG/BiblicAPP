import type { Edition, Paragraph, Work } from '@biblioteca/shared';

import { Bm25Index } from '../search/bm25';
import { baseLanguage, getAnalyzer } from '../text/analyzer';
import type { Analyzer } from '../text/analyzer';
import { chapterKey, extractReferences } from '../text/scripture';
import type { ReferenceLanguage, ScriptureRef } from '../text/scripture';
import type { LoadedPack } from './packs';

export interface LibraryParagraph {
  /** Position in `Library.paragraphs`. */
  docId: number;
  id: string;
  workId: string;
  editionId: string;
  /** Language of the edition as written in the pack ("ro", "en", ...). */
  language: string;
  kind: Paragraph['kind'];
  sectionId: string;
  sectionHeading: string;
  sectionOrdinal: number;
  ordinal: number;
  text: string;
  /**
   * Id of the passage this paragraph belongs to: the id of the paragraph in the source edition,
   * which every translation paragraph carries as `sourceId` (so all language versions share it).
   */
  passageId: string;
  /** `workId|passageId`: the key under which the versions of a passage are grouped. */
  groupKey: string;
  /**
   * `workId|sectionId` of the section in the source edition (a translation's section carries the
   * id of the section it renders as `sourceId`), so every language version of a section shares one
   * key, like `groupKey` does for paragraphs.
   */
  sectionKey: string;
  /** Scripture references the paragraph cites. */
  refs: ScriptureRef[];
}

export interface LibraryEdition {
  editionId: string;
  workId: string;
  packId: string;
  language: string;
  kind: Edition['kind'];
  sourceEditionId?: string;
  licenceStatus: Edition['licence']['status'];
  revision: number;
  version: string;
  sectionCount: number;
  paragraphCount: number;
  paragraphs: LibraryParagraph[];
}

export interface LibraryWork {
  work: Work;
  editions: LibraryEdition[];
}

export interface LanguageIndex {
  /** Base language ("ro", "en"). */
  language: string;
  analyzer: Analyzer;
  index: Bm25Index;
  /** Index position -> paragraph. */
  paragraphs: LibraryParagraph[];
  /** Every term of this language's paragraphs -> a small integer id. */
  vocabulary: ReadonlyMap<string, number>;
  /**
   * The analysed terms of each paragraph, in order, as vocabulary ids (parallel to `paragraphs`).
   * The phrase check of retrieval reads these instead of analysing the text of the candidates again
   * for every question.
   */
  sequences: ReadonlyArray<Uint32Array>;
}

/** Paragraph kinds that can be retrieved; headings are structure, not content. */
const SEARCHABLE_KINDS: ReadonlySet<Paragraph['kind']> = new Set(['p', 'quote', 'note']);

/** Whether a paragraph is text that can be retrieved and shown as a source (not a heading). */
export function isSearchable(paragraph: Pick<LibraryParagraph, 'kind'>): boolean {
  return SEARCHABLE_KINDS.has(paragraph.kind);
}

function referenceLanguage(language: string): ReferenceLanguage {
  const base = baseLanguage(language);
  return base === 'ro' || base === 'en' ? base : 'any';
}

export class Library {
  readonly works: LibraryWork[] = [];
  /** Work id -> the work with its editions. */
  readonly worksById = new Map<string, LibraryWork>();
  readonly editions = new Map<string, LibraryEdition>();
  /** Every paragraph of every verified pack, in `docId` order. */
  readonly paragraphs: LibraryParagraph[] = [];
  /** Paragraph id -> paragraph (ids are unique across editions). */
  readonly paragraphsById = new Map<string, LibraryParagraph>();
  /** Section id of an edition -> its paragraphs in reading order (headings included). */
  readonly sections = new Map<string, LibraryParagraph[]>();
  /** `groupKey` -> the versions of one passage across editions. */
  readonly groups = new Map<string, LibraryParagraph[]>();
  /** Base language -> BM25 index over that language's searchable paragraphs. */
  readonly indexes = new Map<string, LanguageIndex>();
  /** `chapterKey` -> paragraphs citing a verse of that chapter. */
  readonly references = new Map<string, LibraryParagraph[]>();
  readonly packCount: number;

  constructor(packs: readonly LoadedPack[]) {
    this.packCount = packs.length;
    const byLanguage = new Map<string, LibraryParagraph[]>();

    for (const loaded of packs) {
      const { pack, manifest } = loaded;
      const sections = new Map(pack.sections.map((section) => [section.id, section]));
      let entry = this.worksById.get(pack.work.id);
      if (entry === undefined) {
        entry = { work: pack.work, editions: [] };
        this.worksById.set(pack.work.id, entry);
        this.works.push(entry);
      }
      const edition: LibraryEdition = {
        editionId: pack.edition.id,
        workId: pack.work.id,
        packId: manifest.packId,
        language: pack.edition.language,
        kind: pack.edition.kind,
        licenceStatus: pack.edition.licence.status,
        revision: manifest.revision,
        version: manifest.version,
        sectionCount: pack.sections.length,
        paragraphCount: pack.paragraphs.length,
        paragraphs: [],
      };
      if (pack.edition.sourceEditionId !== undefined)
        edition.sourceEditionId = pack.edition.sourceEditionId;
      entry.editions.push(edition);
      this.editions.set(edition.editionId, edition);

      const language = baseLanguage(edition.language);
      for (const paragraph of pack.paragraphs) {
        // Ids are unique across editions by construction (ADR-012); a clash would make citations
        // ambiguous, so the later paragraph is ignored.
        if (this.paragraphsById.has(paragraph.id)) continue;
        const section = sections.get(paragraph.sectionId);
        const libraryParagraph: LibraryParagraph = {
          docId: this.paragraphs.length,
          id: paragraph.id,
          workId: pack.work.id,
          editionId: edition.editionId,
          language: edition.language,
          kind: paragraph.kind,
          sectionId: paragraph.sectionId,
          sectionHeading: section?.heading ?? '',
          sectionOrdinal: section?.ordinal ?? 0,
          ordinal: paragraph.ordinal,
          text: paragraph.text,
          passageId: paragraph.sourceId ?? paragraph.id,
          groupKey: `${pack.work.id}|${paragraph.sourceId ?? paragraph.id}`,
          sectionKey: `${pack.work.id}|${section?.sourceId ?? paragraph.sectionId}`,
          refs: SEARCHABLE_KINDS.has(paragraph.kind)
            ? extractReferences(paragraph.text, { language: referenceLanguage(edition.language) })
            : [],
        };
        this.paragraphs.push(libraryParagraph);
        this.paragraphsById.set(libraryParagraph.id, libraryParagraph);
        edition.paragraphs.push(libraryParagraph);
        const inSection = this.sections.get(libraryParagraph.sectionId);
        if (inSection === undefined)
          this.sections.set(libraryParagraph.sectionId, [libraryParagraph]);
        else inSection.push(libraryParagraph);
        const group = this.groups.get(libraryParagraph.groupKey);
        if (group === undefined) this.groups.set(libraryParagraph.groupKey, [libraryParagraph]);
        else group.push(libraryParagraph);
        for (const ref of libraryParagraph.refs) {
          const key = chapterKey(ref);
          const bucket = this.references.get(key);
          if (bucket === undefined) this.references.set(key, [libraryParagraph]);
          else if (!bucket.includes(libraryParagraph)) bucket.push(libraryParagraph);
        }
        if (SEARCHABLE_KINDS.has(paragraph.kind)) {
          const list = byLanguage.get(language);
          if (list === undefined) byLanguage.set(language, [libraryParagraph]);
          else list.push(libraryParagraph);
        }
      }
    }

    // Reading order does not depend on the order the pack lists its paragraphs in.
    for (const inSection of this.sections.values()) inSection.sort((a, b) => a.ordinal - b.ordinal);

    for (const [language, paragraphs] of byLanguage) {
      const analyzer = getAnalyzer(language);
      const vocabulary = new Map<string, number>();
      const sequences: Uint32Array[] = [];
      const documents = paragraphs.map((paragraph) => {
        const terms = analyzer.analyze(paragraph.text);
        const ids = new Uint32Array(terms.length);
        terms.forEach((term, position) => {
          let id = vocabulary.get(term);
          if (id === undefined) {
            id = vocabulary.size;
            vocabulary.set(term, id);
          }
          ids[position] = id;
        });
        sequences.push(ids);
        return terms;
      });
      const index = new Bm25Index(documents);
      this.indexes.set(language, { language, analyzer, index, paragraphs, vocabulary, sequences });
    }
  }

  get paragraphCount(): number {
    return this.paragraphs.length;
  }

  get editionCount(): number {
    return this.editions.size;
  }

  get workCount(): number {
    return this.works.length;
  }
}

export function buildLibrary(packs: readonly LoadedPack[]): Library {
  return new Library(packs);
}

/**
 * The ordinal (from 0) of the section a paragraph belongs to in the source edition of its
 * passage: the same number for every language version of the passage, whichever edition the
 * paragraph is in (a translation that covers only some sections numbers them by itself).
 */
export function sourceSectionOrdinal(library: Library, paragraph: LibraryParagraph): number {
  const members = library.groups.get(paragraph.groupKey) ?? [paragraph];
  const source = members.find(
    (member) => library.editions.get(member.editionId)?.kind === 'source',
  );
  return (source ?? paragraph).sectionOrdinal;
}
