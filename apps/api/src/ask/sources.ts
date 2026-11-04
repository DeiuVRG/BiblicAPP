import { makeExcerpt } from '../library/excerpt';
import { baseLanguage } from '../text/analyzer';
import type { Library, LibraryParagraph, LibraryWork } from '../library/library';
import type { RetrievalResult, RetrievedPassage } from '../library/retrieve';
import type { AlignedVersion, Language, Source } from '../types';

/** A source with the full text of the versions the model gets to read. */
export interface PromptSource {
  source: Source;
  /** What the model is told about the work besides the text. */
  context: { year: number | null; born: number | null; died: number | null };
  /** Full text of the version shown (`source.language`). */
  text: string;
  /** The original-language text when the version shown is a translation and the original is installed. */
  original?: { language: string; text: string; paragraphId: string };
}

/** Longest paragraph handed to the model; longer ones are cut at a sentence end. */
const MAX_PROMPT_CHARS = 3500;

function clip(text: string): string {
  if (text.length <= MAX_PROMPT_CHARS) return text;
  const cut = text.slice(0, MAX_PROMPT_CHARS);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return `${sentence > MAX_PROMPT_CHARS * 0.5 ? cut.slice(0, sentence + 1) : cut.trimEnd()} …`;
}

function workTitle(work: LibraryWork['work'], language: Language): string {
  return language === 'ro' ? work.titleRo : (work.titleEn ?? work.titleOrig);
}

function toAligned(library: Library, paragraph: LibraryParagraph): AlignedVersion {
  return {
    editionId: paragraph.editionId,
    sectionId: paragraph.sectionId,
    paragraphId: paragraph.id,
    language: paragraph.language,
    kind: library.editions.get(paragraph.editionId)?.kind === 'source' ? 'source' : 'translation',
    sectionHeading: paragraph.sectionHeading,
    excerpt: makeExcerpt(paragraph.text, '', paragraph.language),
  };
}

function toPromptSource(
  library: Library,
  works: ReadonlyMap<string, LibraryWork>,
  passage: RetrievedPassage,
  queries: ReadonlyMap<string, string>,
  fallbackQuery: string,
  language: Language,
): PromptSource {
  const primary = passage.primary;
  const work = works.get(primary.workId)?.work;
  const kind =
    library.editions.get(primary.editionId)?.kind === 'source' ? 'source' : 'translation';
  const source: Source = {
    id: primary.passageId,
    workId: primary.workId,
    editionId: primary.editionId,
    sectionId: primary.sectionId,
    paragraphId: primary.id,
    workTitle: work !== undefined ? workTitle(work, language) : '',
    sectionHeading: primary.sectionHeading,
    language: primary.language,
    // Centred on the words that matched in the language of the version shown.
    excerpt: makeExcerpt(
      primary.text,
      queries.get(baseLanguage(primary.language)) ?? fallbackQuery,
      primary.language,
    ),
    kind,
    author: work?.author.name ?? '',
    tradition: work?.author.tradition ?? '',
    score: Math.round(passage.score * 1000) / 1000,
    matchedRefs: passage.matchedRefs,
    aligned: passage.aligned.map((paragraph) => toAligned(library, paragraph)),
  };
  const result: PromptSource = {
    source,
    context: {
      year: work?.year ?? null,
      born: work?.author.born ?? null,
      died: work?.author.died ?? null,
    },
    text: clip(primary.text),
  };
  if (kind === 'translation') {
    const original = passage.aligned.find(
      (paragraph) => library.editions.get(paragraph.editionId)?.kind === 'source',
    );
    if (original !== undefined) {
      result.original = {
        language: original.language,
        text: clip(original.text),
        paragraphId: original.id,
      };
    }
  }
  return result;
}

/** Turns retrieved passages into numbered sources (index + 1 is the `[n]` of the answer). */
export function buildSources(
  library: Library,
  retrieval: RetrievalResult,
  language: Language,
): PromptSource[] {
  const works = new Map(library.works.map((entry) => [entry.work.id, entry]));
  return retrieval.passages.map((passage) =>
    toPromptSource(library, works, passage, retrieval.queries, retrieval.queryText, language),
  );
}
