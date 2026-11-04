import { PackSchema } from '@biblioteca/shared';
import type { Pack, Paragraph, Section } from '@biblioteca/shared';
import { stableId } from '@biblioteca/shared/ids';

import { defined } from '../lib/invariant';
import { formatZodError } from './io';
import { collectRows, countBySeverity, renderReview } from './review';
import type { LoadedFile, ReviewRow, ReviewSeverity } from './review';
import type {
  CheckReport,
  CriticReport,
  OutputParagraph,
  TranslationEditionMeta,
  TranslationOutput,
} from './schemas';
import { joinList } from './text-utils';

export interface MergeInput {
  /** The source edition the translation is aligned to. */
  source: Pack;
  meta: TranslationEditionMeta;
  /** The existing `edition-<lang>.json`, whose ids are reused by `sourceId`. */
  previous?: Pack | undefined;
  finals: readonly LoadedFile<TranslationOutput>[];
  critics: readonly LoadedFile<CriticReport>[];
  checks: readonly LoadedFile<CheckReport>[];
  /** Emit only the sections whose paragraphs are all covered. */
  partial: boolean;
  /** Merge although a CRITIC flag or CRITIC check finding is open. */
  allowCritic: boolean;
}

export interface MergeResult {
  /** The merged edition; absent when the merge is refused. */
  pack?: Pack;
  /** `review.md`; absent when the coverage is incomplete (nothing to review yet). */
  review?: string;
  /** Why the merge was refused. */
  problems: string[];
  /** Non-fatal observations (heading fallbacks). */
  warnings: string[];
  coverage: { paragraphs: [number, number]; sections: [number, number] };
  counts: Record<ReviewSeverity, number>;
  /** Id of the translated edition and where it came from (only `meta` is already stored). */
  editionId: string;
  editionIdSource: 'meta' | 'previous' | 'generated';
}

interface Rendering {
  paragraph: OutputParagraph;
  output: TranslationOutput;
  file: string;
}

function sortedFinals(finals: MergeInput['finals']): MergeInput['finals'] {
  return [...finals].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** One rendering per source paragraph; unknown and repeated `sourceId`s are problems. */
function indexRenderings(
  source: Pack,
  finals: MergeInput['finals'],
  problems: string[],
): Map<string, Rendering> {
  const known = new Set(source.paragraphs.map((p) => p.id));
  const renderings = new Map<string, Rendering>();
  for (const { file, data: output } of sortedFinals(finals)) {
    for (const paragraph of output.paragraphs) {
      if (!known.has(paragraph.sourceId)) {
        problems.push(
          `${file}: sourceId ${paragraph.sourceId} is not a paragraph of the source edition`,
        );
        continue;
      }
      const earlier = renderings.get(paragraph.sourceId);
      if (earlier) {
        problems.push(
          `${file}: source paragraph ${paragraph.sourceId} is already rendered in ${earlier.file}`,
        );
        continue;
      }
      renderings.set(paragraph.sourceId, { paragraph, output, file });
    }
  }
  return renderings;
}

function paragraphsBySection(source: Pack): Map<string, Paragraph[]> {
  const bySection = new Map<string, Paragraph[]>();
  for (const paragraph of source.paragraphs) {
    const list = bySection.get(paragraph.sectionId) ?? [];
    list.push(paragraph);
    bySection.set(paragraph.sectionId, list);
  }
  for (const list of bySection.values()) list.sort((a, b) => a.ordinal - b.ordinal);
  return bySection;
}

/** Sections whose paragraphs are all rendered and whose parent (if any) is also emitted. */
function emittedSectionIds(
  sections: readonly Section[],
  bySection: Map<string, Paragraph[]>,
  renderings: Map<string, Rendering>,
): Set<string> {
  const covered = new Set(
    sections
      .filter((s) => (bySection.get(s.id) ?? []).every((p) => renderings.has(p.id)))
      .map((s) => s.id),
  );
  const byId = new Map(sections.map((s) => [s.id, s]));
  const emitted = new Set<string>();
  const visit = (section: Section, trail: Set<string>): boolean => {
    if (emitted.has(section.id)) return true;
    if (!covered.has(section.id) || trail.has(section.id)) return false;
    const parent = section.parentId === undefined ? undefined : byId.get(section.parentId);
    if (parent && !visit(parent, new Set([...trail, section.id]))) return false;
    emitted.add(section.id);
    return true;
  };
  for (const section of sections) visit(section, new Set());
  return emitted;
}

function missingReport(
  sections: readonly Section[],
  bySection: Map<string, Paragraph[]>,
  renderings: Map<string, Rendering>,
): string[] {
  const lines: string[] = [];
  for (const section of sections) {
    const paragraphs = bySection.get(section.id) ?? [];
    const missing = paragraphs.filter((p) => !renderings.has(p.id));
    if (missing.length === 0) continue;
    const listed = missing.map((p) => `${p.ordinal + 1} (${p.id})`).join(', ');
    lines.push(
      `section ${section.ordinal + 1} "${section.heading}": ${missing.length} of ${paragraphs.length} paragraphs have no final rendering: ${listed}`,
    );
  }
  return lines;
}

function reuseMap<T extends { id: string; sourceId?: string | undefined }>(
  units: readonly T[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const unit of units ?? []) if (unit.sourceId !== undefined) map.set(unit.sourceId, unit.id);
  return map;
}

/**
 * Builds the canonical translated edition and the review sheet from the final outputs
 * (docs/traducere-pipeline.md, section 3.3). Pure apart from `stableId()` for new units.
 */
export function mergeTranslation(input: MergeInput): MergeResult {
  const { source, meta, previous } = input;
  const problems: string[] = [];
  const warnings: string[] = [];
  const sections = [...source.sections].sort((a, b) => a.ordinal - b.ordinal);
  const bySection = paragraphsBySection(source);
  const renderings = indexRenderings(source, input.finals, problems);

  // The edition id is generated once; an existing edition file keeps the id it already has.
  const editionIdSource =
    meta.edition.id !== undefined ? 'meta' : previous ? 'previous' : 'generated';
  const editionId = meta.edition.id ?? previous?.edition.id ?? stableId();
  const base = { warnings, editionId, editionIdSource, counts: countBySeverity([]) } as const;

  const missing = missingReport(sections, bySection, renderings);
  const emittedIds = emittedSectionIds(sections, bySection, renderings);
  const emitted = sections.filter((s) => emittedIds.has(s.id));
  const emittedParagraphCount = emitted.reduce(
    (sum, s) => sum + (bySection.get(s.id) ?? []).length,
    0,
  );
  const coverage = {
    paragraphs: [emittedParagraphCount, source.paragraphs.length] as [number, number],
    sections: [emitted.length, sections.length] as [number, number],
  };

  if (!input.partial && missing.length > 0) problems.push(...missing);
  if (input.partial && emitted.length === 0)
    problems.push('no section is fully covered, nothing to merge');
  if (problems.length > 0) return { ...base, problems, coverage };

  // Ids: reused by sourceId from the previous edition, new units get new ids.
  const sectionIds = reuseMap(previous?.sections);
  const paragraphIds = reuseMap(previous?.paragraphs);
  const newSectionId = new Map<string, string>();
  for (const section of emitted)
    newSectionId.set(section.id, sectionIds.get(section.id) ?? stableId());
  const mergedSections: Section[] = emitted.map((section) => {
    const id = defined(newSectionId.get(section.id), 'section id');
    const firstParagraph = (bySection.get(section.id) ?? [])[0];
    const headingRo = firstParagraph
      ? renderings.get(firstParagraph.id)?.output.headingRo?.normalize('NFC').trim()
      : undefined;
    if (!headingRo) {
      warnings.push(
        `section ${section.ordinal + 1} "${section.heading}": no headingRo in the part-0 output, using the source heading`,
      );
    }
    const merged: Section = {
      id,
      ordinal: section.ordinal,
      kind: section.kind,
      heading: headingRo || section.heading,
    };
    if (section.parentId !== undefined) {
      merged.parentId = defined(newSectionId.get(section.parentId), 'parent section id');
    }
    merged.sourceId = section.id;
    return merged;
  });

  const mergedParagraphs: Paragraph[] = [];
  for (const paragraph of source.paragraphs) {
    const sectionId = newSectionId.get(paragraph.sectionId);
    const rendering = renderings.get(paragraph.id);
    if (sectionId === undefined || !rendering) continue;
    mergedParagraphs.push({
      id: paragraphIds.get(paragraph.id) ?? stableId(),
      sectionId,
      ordinal: paragraph.ordinal,
      kind: paragraph.kind,
      text: rendering.paragraph.text.normalize('NFC'),
      sourceId: paragraph.id,
    });
  }

  const notes =
    input.partial && emitted.length < sections.length
      ? [
          meta.edition.provenance.notes,
          `Partial translation: ${emitted.length} of ${sections.length} sections.`,
        ]
          .filter((part) => part !== '')
          .join(' ')
      : meta.edition.provenance.notes;
  const parsed = PackSchema.safeParse({
    work: source.work,
    edition: {
      id: editionId,
      language: meta.edition.language,
      kind: 'translation',
      licence: meta.edition.licence,
      provenance: { ...meta.edition.provenance, notes },
      sourceEditionId: source.edition.id,
    },
    sections: mergedSections,
    paragraphs: mergedParagraphs,
  });
  if (!parsed.success) {
    problems.push(`the merged edition does not validate:\n  ${formatZodError(parsed.error)}`);
    return { ...base, problems, coverage };
  }

  const emittedParagraphs = new Map<string, { sectionOrdinal: number; paragraphOrdinal: number }>();
  const sectionOrdinalOf = new Map(sections.map((s) => [s.id, s.ordinal]));
  for (const paragraph of source.paragraphs) {
    const sectionOrdinal = sectionOrdinalOf.get(paragraph.sectionId);
    if (sectionOrdinal !== undefined && newSectionId.has(paragraph.sectionId)) {
      emittedParagraphs.set(paragraph.id, { sectionOrdinal, paragraphOrdinal: paragraph.ordinal });
    }
  }
  // Without a check report of the final text, nothing but the flags guards against CRITIC defects.
  const checked = new Set(input.checks.map((check) => check.data.file));
  const unchecked = sortedFinals(input.finals)
    .map((final) => final.file)
    .filter((file) => !checked.has(file));
  if (unchecked.length > 0) {
    warnings.push(
      `no check report for ${unchecked.length} final output(s), run translation-check on them: ` +
        joinList(unchecked, 4),
    );
  }
  const reviewInput = {
    title: source.work.titleRo,
    titleOrig: source.work.titleOrig,
    slug: source.work.slug,
    sourceLanguage: source.edition.language,
    targetLanguage: meta.edition.language,
    coverage,
    emittedParagraphs,
    emittedSections: new Set(emitted.map((s) => s.ordinal)),
    finals: input.finals,
    critics: input.critics,
    checks: input.checks,
  };
  const rows: ReviewRow[] = collectRows(reviewInput);
  const review = renderReview(reviewInput, rows);
  const counts = countBySeverity(rows);

  const blockers = rows.filter((row) => row.severity === 'CRITIC' && row.origin !== 'critic');
  if (blockers.length > 0 && !input.allowCritic) {
    for (const row of blockers) {
      problems.push(
        `open CRITIC finding (${row.origin}) section ${row.sectionOrdinal + 1}` +
          `${row.sourceId === undefined ? '' : `, ${row.sourceId}`}: ${row.problem}`,
      );
    }
    return { ...base, counts, problems, coverage, review };
  }
  return { ...base, counts, problems, coverage, review, pack: parsed.data };
}
