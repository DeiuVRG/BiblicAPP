import type { Edition, ProvenanceCheck, ProvenanceCorrection } from '@biblioteca/shared';

import { baseLanguage } from '@/i18n/language';

// How an edition was made, as the Transparency panel and the status chip say it (docs/ui-spec-v2.md,
// 8.6). `ProvenanceSchema` has new optional fields; this reads them and, where they are absent, derives
// what it can from the kind of the edition and from the free-text record that every pack has (source,
// extractedBy, notes), with the precedence ai, human, transcription, source, native, unknown. Nothing
// is invented: a text that says nothing is "unknown", and the panel says so.

/** The lead note: which sentence opens the panel. `transcription` is also a lead when nothing else is known. */
export type LeadKind = 'ai' | 'human' | 'native' | 'source' | 'transcription' | 'unknown';

export interface ResolvedProvenance {
  lead: LeadKind;
  /** The text is also a transcription of a printed edition: a second note under the lead note. */
  transcriptionNote: boolean;
  /** A machine translation: the toolbar button reads "Transparență AI". */
  machine: boolean;
  /** The language that was translated ("en"), for a translation; null otherwise or when not recorded. */
  sourceLanguage: string | null;
  model: string | null;
  /** An ISO date or date-time, or null. */
  generatedAt: string | null;
  passes: readonly string[];
  checks: readonly ProvenanceCheck[];
  /** What a source edition is (the scan, the transcription, the cleaning), or null. */
  sourceDescription: string | null;
  reviewed: boolean;
  reviewedAt: string | null;
  /** The role of the reviewer, shown instead of a name; null when none was recorded. */
  reviewerRole: string | null;
  /** Newest first. */
  corrections: readonly ProvenanceCorrection[];
  /** The free-text record of the edition (shown as the description under the lead note). */
  source: string;
  notes: string;
}

const AI_MARKERS =
  /\b(?:AI|IA|LLM)\b|artificial|inteligen[țţt]|machine[- ]translat|mașin|claude|sonnet|opus|\bgpt\b/i;
const HUMAN_MARKERS = /\btranslated by\b|\btranslator\b|\btradus(?:ă)? de\b|\btraducător/i;
const TRANSCRIPTION_MARKERS = /\bOCR\b|\bscan\b|\bscanned\b|\bscană\b|\bscanare\b|transcri/i;

/** A date as it sorts: ISO dates compare as strings, and a bare date comes before the same day's time. */
const newestFirst = (a: ProvenanceCorrection, b: ProvenanceCorrection) =>
  a.at < b.at ? 1 : a.at > b.at ? -1 : 0;

/**
 * Which sentence a pack without a `kind` gets. The reading languages are the languages of the
 * product, so a source in Romanian or English is "written in" that language (nothing was
 * translated) and a source in another language is "the original text".
 */
function deriveLead(edition: Edition, text: string): LeadKind {
  const translation = edition.kind === 'translation';
  if (translation && AI_MARKERS.test(text)) return 'ai';
  if (translation && HUMAN_MARKERS.test(text)) return 'human';
  if (!translation && TRANSCRIPTION_MARKERS.test(text)) return 'transcription';
  if (!translation) {
    const language = baseLanguage(edition.language);
    return language === 'ro' || language === 'en' ? 'native' : 'source';
  }
  return 'unknown';
}

export function resolveProvenance(edition: Edition): ResolvedProvenance {
  const { provenance } = edition;
  const text = [provenance.source, provenance.extractedBy, provenance.notes].join(' ');
  const lead: LeadKind = provenance.kind ?? deriveLead(edition, text);
  // The flag says "also": when the lead is itself the transcription note there is no second one.
  const transcriptionNote = lead !== 'transcription' && provenance.transcription === true;
  const review = provenance.review;
  return {
    lead,
    transcriptionNote,
    machine: lead === 'ai',
    sourceLanguage: provenance.sourceLanguage ?? null,
    model: provenance.model ?? null,
    generatedAt: provenance.generatedAt ?? null,
    passes: provenance.passes ?? [],
    checks: provenance.checks ?? [],
    sourceDescription: provenance.sourceDescription ?? null,
    reviewed: review?.state === 'reviewed',
    reviewedAt: review?.state === 'reviewed' ? (review.at ?? null) : null,
    reviewerRole: review?.state === 'reviewed' ? (review.roleNote?.trim() || null) : null,
    corrections: [...(provenance.corrections ?? [])].sort(newestFirst),
    source: provenance.source,
    notes: provenance.notes,
  };
}

/** The number of flags still open over all the automatic checks of a translation. */
export function openFlags(checks: readonly ProvenanceCheck[]): number {
  return checks.reduce((sum, check) => sum + (check.status === 'flagged' ? (check.flags ?? 1) : 0), 0);
}

/** The corrections on one page of the panel, newest first, five per page (page 0 is the first). */
export const CORRECTIONS_PER_PAGE = 5;

export function correctionsPage(
  corrections: readonly ProvenanceCorrection[],
  page: number,
): { items: readonly ProvenanceCorrection[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(corrections.length / CORRECTIONS_PER_PAGE));
  const current = Math.min(Math.max(0, page), pages - 1);
  return {
    items: corrections.slice(current * CORRECTIONS_PER_PAGE, (current + 1) * CORRECTIONS_PER_PAGE),
    pages,
    page: current,
  };
}
