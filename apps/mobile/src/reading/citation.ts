import { languageName } from '@/i18n/labels';
import type { Strings } from '@/i18n/strings';

// The citation of a paragraph (docs/ui-spec-v2.md, 8.9): the text, a blank line, then
// "— <Author>, <Title>, <section> (<the edition>). — <URL>". The edition is named only when the work
// has several editions, inside the citation, before ". — <URL>". The Report mail carries the same
// line, so that a report names the place exactly.

export interface CitationParts {
  author: string;
  title: string;
  /** The heading of the section ("IV. Împărăția prezentă și Împărăția viitoare"). */
  section: string;
  /** The language of the edition cited, named only when the work has several editions. */
  editionLanguage?: string;
  url: string;
}

/** "ediția engleză" / "English edition": how the edition is named inside a citation. */
export function citationEdition(languageCode: string, t: Strings): string {
  return t.reader.citeEdition(languageName(languageCode, t));
}

/** "— Geerhardus Vos, Titlu, Secțiune (ediția română). — https://…" */
export function citationLine(parts: CitationParts, t: Strings): string {
  const who = [parts.author, parts.title, parts.section]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(', ');
  const edition = parts.editionLanguage ? ` (${citationEdition(parts.editionLanguage, t)})` : '';
  return `— ${who}${edition}. — ${parts.url}`;
}

/** The text of a paragraph followed by its citation after a blank line. */
export function textWithCitation(text: string, citation: string): string {
  return `${text.trim()}\n\n${citation}`;
}
