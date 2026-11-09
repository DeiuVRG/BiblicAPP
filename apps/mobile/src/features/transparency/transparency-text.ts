import type { Edition } from '@biblioteca/shared';

import { mailtoHref } from '@/config/contact';
import { openFlags } from '@/content/provenance';
import type { ResolvedProvenance } from '@/content/provenance';
import { formatDateLong, languageName } from '@/i18n/labels';
import type { Strings } from '@/i18n/strings';

// The words of the Transparency panel and of the status chip (docs/ui-spec-v2.md, 7 and 8.6): what each
// kind of provenance says, in the interface language. Pure functions over a resolved record, so that
// the panel, the work hub and the policy page say the same thing and the tests can read it.

/**
 * The source line of an edition as a reader sees it: the free-text record of a pack may point at a file
 * of the repository ("see content/INVENTORY.md, P1-07"); that is a note for us, not for the reader.
 */
export function publicSourceText(text: string): string {
  return text
    .replace(/\s*\((?:see\s+)?content\/[^)]*\)/gi, '')
    .replace(/\s+([.,;])/g, '$1')
    .trim();
}

/** "Traducere AI · Neverificată", "Traducere · Verificată", "Text original": the chip of the work page. */
export function statusChipLabel(resolved: ResolvedProvenance, t: Strings): string {
  const state = resolved.reviewed ? t.transparency.reviewed : t.transparency.needsReview;
  switch (resolved.lead) {
    case 'ai':
      return `${t.work.chipTranslationAi} · ${state}`;
    case 'human':
      return `${t.work.chipTranslation} · ${state}`;
    case 'native':
    case 'source':
      return t.work.chipOriginal;
    case 'transcription':
      return t.work.chipTranscription;
    case 'unknown':
      return t.work.chipUnknown;
  }
}

/** The label of the toolbar button: "Transparență AI" for a machine translation, "Transparență" otherwise. */
export const buttonLabel = (resolved: ResolvedProvenance, t: Strings): string =>
  resolved.machine ? t.reader.transparencyAi : t.reader.transparency;

/** The word for a language written in a sentence ("engleză" in Romanian, "English" in English). */
function inSentence(code: string | null | undefined, fallback: string, t: Strings): string {
  return code ? languageName(code, t) : fallback;
}

/** "Tradusă cu AI din engleză · Neverificată": how it was made, then whether anyone read it. */
export function factsLine(resolved: ResolvedProvenance, edition: Edition, t: Strings): string {
  const how = (() => {
    switch (resolved.lead) {
      case 'ai':
        return resolved.sourceLanguage
          ? t.transparency.factAi(languageName(resolved.sourceLanguage, t))
          : t.transparency.factAiUnknown;
      case 'human':
        return t.transparency.factHuman;
      case 'native':
        return t.transparency.factNative(languageName(edition.language, t));
      case 'source':
        return t.transparency.factSource;
      case 'transcription':
        return t.transparency.factTranscription;
      case 'unknown':
        return t.transparency.factUnknown;
    }
  })();
  const date = formatDateLong(resolved.reviewedAt, t);
  const state = resolved.reviewed
    ? date === ''
      ? t.transparency.reviewed
      : `${t.transparency.reviewed} (${date})`
    : t.transparency.needsReview;
  return [how, state].join(' · ');
}

export interface LeadNote {
  /** The bold sentence. */
  lead: string;
  /** The paragraph that follows it. */
  body: string;
}

/** The lead note of a kind (the table of 8.6): a bold sentence and a paragraph. */
export function leadNote(
  resolved: ResolvedProvenance,
  edition: Edition,
  workOriginalLanguage: string,
  t: Strings,
): LeadNote {
  const x = t.transparency;
  switch (resolved.lead) {
    case 'ai':
      return {
        lead: x.leadAi.lead,
        body: x.leadAi.body(
          languageName(edition.language, t),
          inSentence(resolved.sourceLanguage, languageName(workOriginalLanguage, t), t),
        ),
      };
    case 'human':
      return { lead: x.leadHuman.lead, body: `${x.leadHuman.credit} ${x.leadHuman.body}` };
    case 'native':
      return {
        lead: x.leadNative.lead(languageName(edition.language, t)),
        body: x.leadNative.body,
      };
    case 'source':
      return {
        lead: x.leadSource.lead,
        body: resolved.sourceDescription ?? x.leadSource.fallback,
      };
    case 'transcription':
      return { lead: x.leadTranscription.lead, body: x.leadTranscription.body };
    case 'unknown':
      return { lead: x.leadUnknown.lead, body: x.leadUnknown.body };
  }
}

/** The second note under the lead, for an edition that is also a transcription of a printed one. */
export const transcriptionNote = (resolved: ResolvedProvenance, t: Strings): LeadNote | null =>
  resolved.transcriptionNote
    ? { lead: t.transparency.leadTranscription.lead, body: t.transparency.leadTranscription.body }
    : null;

/** The sentence of the VERIFICARE row: a reviewer for a translation, an editor for any other work. */
export function reviewSentence(
  resolved: ResolvedProvenance,
  translation: boolean,
  t: Strings,
): string {
  const x = t.transparency;
  if (!resolved.reviewed) return translation ? x.reviewTranslationNeeds : x.reviewWorkNeeds;
  const date = formatDateLong(resolved.reviewedAt, t);
  const role = resolved.reviewerRole ?? '';
  return translation ? x.reviewTranslationDone(date, role) : x.reviewWorkDone(date, role);
}

/** "ciornă, critic independent, revizie": the passes, each named when the app knows its name. */
export function passesText(resolved: ResolvedProvenance, t: Strings): string | null {
  if (resolved.passes.length === 0) return null;
  const names: Readonly<Record<string, string>> = t.transparency.passNames;
  return t.transparency.passes(resolved.passes.map((pass) => names[pass] ?? pass).join(', '));
}

export interface CheckLine {
  code: string;
  name: string;
  /** "fără semnalări" or "4 semnalări deschise". */
  result: string;
  flagged: boolean;
}

/** The automatic checks that ran, one line each, with what they left open. */
export function checkLines(resolved: ResolvedProvenance, t: Strings): CheckLine[] {
  const names: Readonly<Record<string, string>> = t.transparency.checkNames;
  return resolved.checks.map((check) => ({
    code: check.code,
    name: names[check.code] ?? check.code,
    flagged: check.status === 'flagged',
    result:
      check.status === 'flagged'
        ? t.transparency.checkFlagged(check.flags ?? 1)
        : t.transparency.checkPassed,
  }));
}

/** Open flags over all the checks: the number the panel can say. */
export const totalOpenFlags = (resolved: ResolvedProvenance): number => openFlags(resolved.checks);

export interface ReportContext {
  /** The title of the work in the reading language. */
  title: string;
  /** Empty for a report about the library as a whole (the policy page). */
  editionId: string;
  /** The language of the edition ("ro"). */
  language: string;
  sourceEditionId?: string;
  sectionId?: string;
  paragraphId?: string;
  /** The paragraph of the source edition that the open paragraph renders (its own id in a source). */
  sourceParagraphId?: string;
  /** The citation line of the open paragraph. */
  citation?: string;
}

/**
 * The mail of a report (docs/ui-spec-v2.md, 8.6, P1): a subject naming the work and the language of the
 * edition, and a body with the kinds of problem to choose from, the identifiers of the edition and of
 * the open paragraph and of the source paragraph it renders, the citation, and a line for the comment.
 */
export function reportMailHref(context: ReportContext, t: Strings, address?: string): string {
  const x = t.transparency;
  const line = (label: string, value: string | undefined) =>
    value === undefined || value === '' ? [] : [`${label}: ${value}`];
  const body = [
    x.reportIntro,
    '',
    `${x.reportType}:`,
    ...line(x.reportEdition, context.editionId),
    ...line(x.reportLanguage, context.language),
    ...line(x.reportSourceEdition, context.sourceEditionId),
    ...line(x.reportSection, context.sectionId),
    ...line(x.reportParagraph, context.paragraphId),
    ...line(x.reportSourceParagraph, context.sourceParagraphId),
    ...line(x.reportCitation, context.citation),
    '',
    `${x.reportComment}:`,
    '',
  ].join('\n');
  return mailtoHref(x.reportSubject(context.title, context.language), body, address);
}
