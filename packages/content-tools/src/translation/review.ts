import type { CheckReport, CriticReport, TranslationOutput } from './schemas';

/** A validated input file together with its path relative to the translation directory. */
export interface LoadedFile<T> {
  /** `final/<jobId>.json`, `critic/<jobId>.json` or `checks/<jobId>.json`. */
  file: string;
  data: T;
}

export const REVIEW_SEVERITIES = [
  'CRITIC',
  'MAJOR',
  'SURSA_POSIBIL_ERONATA',
  'MINOR',
  'INFO',
] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];
export type ReviewOrigin = 'critic' | 'draft' | 'revised' | 'check';

const ORIGIN_RANK: Record<ReviewOrigin, number> = { critic: 0, draft: 1, revised: 2, check: 3 };

export interface ReviewRow {
  severity: ReviewSeverity;
  sectionOrdinal: number;
  /** -1 for findings of a whole job (no paragraph). */
  paragraphOrdinal: number;
  sourceId?: string;
  source: string;
  target: string;
  problem: string;
  proposal: string;
  origin: ReviewOrigin;
}

export interface ReviewInput {
  title: string;
  titleOrig: string;
  slug: string;
  sourceLanguage: string;
  targetLanguage: string;
  coverage: { paragraphs: readonly [number, number]; sections: readonly [number, number] };
  /** Position of every paragraph of the merged edition, by source paragraph id. */
  emittedParagraphs: ReadonlyMap<string, { sectionOrdinal: number; paragraphOrdinal: number }>;
  /** Ordinals of the sections of the merged edition. */
  emittedSections: ReadonlySet<number>;
  finals: readonly LoadedFile<TranslationOutput>[];
  critics: readonly LoadedFile<CriticReport>[];
  checks: readonly LoadedFile<CheckReport>[];
}

/** `vos-1903-kingdom-ro-03-01` is part 1 of the section with ordinal 2. */
function sectionOfJob(jobId: string): number | null {
  const match = /-(\d{2,})-\d{2,}$/.exec(jobId);
  return match?.[1] === undefined ? null : Number.parseInt(match[1], 10) - 1;
}

/**
 * Two quotes name the same passage when they are equal (NFC, trimmed). An empty quote names no
 * passage: an omission has nothing to quote, so two empty quotes must not make a critic finding
 * look like a flag of the final output about something else.
 */
function sameQuote(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  const left = a.normalize('NFC').trim();
  return left !== '' && left === b.normalize('NFC').trim();
}

/**
 * Every open finding of the merged paragraphs: critic findings, flags of the final outputs and
 * findings of the deterministic checks of the final outputs. Findings that were auto-fixed are
 * closed and not listed; a check's FLAG_CRITIC is not listed because the flag itself is.
 */
export function collectRows(input: ReviewInput): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const positionOf = (
    sourceId: string,
  ): { sectionOrdinal: number; paragraphOrdinal: number } | undefined =>
    input.emittedParagraphs.get(sourceId);

  const flagQuotes = new Map<string, (string | undefined)[]>();
  for (const { data: output } of input.finals) {
    for (const paragraph of output.paragraphs) {
      const position = positionOf(paragraph.sourceId);
      if (!position) continue;
      for (const flag of paragraph.flags) {
        const quotes = flagQuotes.get(paragraph.sourceId) ?? [];
        quotes.push(flag.quoteTarget);
        flagQuotes.set(paragraph.sourceId, quotes);
        rows.push({
          severity: flag.severity,
          ...position,
          sourceId: paragraph.sourceId,
          source: flag.quoteSource ?? '',
          target: flag.quoteTarget ?? '',
          problem: `[${flag.code}] ${flag.note}`,
          proposal: '',
          origin: output.pass,
        });
      }
    }
  }

  for (const { data: report } of input.critics) {
    for (const found of report.findings) {
      const position = positionOf(found.sourceId);
      if (!position) continue;
      // The final output wins over a critic finding about the same passage.
      if (
        (flagQuotes.get(found.sourceId) ?? []).some((quote) => sameQuote(quote, found.quoteTarget))
      ) {
        continue;
      }
      rows.push({
        severity: found.severity,
        ...position,
        sourceId: found.sourceId,
        source: found.quoteSource,
        target: found.quoteTarget,
        problem: `[${found.category}] ${found.problem}`,
        proposal: found.proposal,
        origin: 'critic',
      });
    }
  }

  for (const { data: report } of input.checks) {
    // A report about a draft says nothing about the final text.
    if (!report.file.startsWith('final/')) continue;
    const jobSection = sectionOfJob(report.jobId);
    for (const found of report.findings) {
      if (found.autofixed === true || found.check === 'FLAG_CRITIC') continue;
      const position = found.sourceId === undefined ? undefined : positionOf(found.sourceId);
      if (found.sourceId !== undefined && !position) continue;
      if (
        found.sourceId === undefined &&
        jobSection !== null &&
        !input.emittedSections.has(jobSection)
      ) {
        continue;
      }
      rows.push({
        severity: found.severity,
        sectionOrdinal: position?.sectionOrdinal ?? jobSection ?? Number.MAX_SAFE_INTEGER,
        paragraphOrdinal: position?.paragraphOrdinal ?? -1,
        ...(found.sourceId === undefined ? {} : { sourceId: found.sourceId }),
        source: found.quoteSource ?? '',
        target: found.quoteTarget ?? '',
        problem: `[${found.check}] ${found.message}`,
        proposal: '',
        origin: 'check',
      });
    }
  }
  return sortRows(rows);
}

function sortRows(rows: ReviewRow[]): ReviewRow[] {
  const severityRank = (row: ReviewRow): number => REVIEW_SEVERITIES.indexOf(row.severity);
  return [...rows].sort(
    (a, b) =>
      severityRank(a) - severityRank(b) ||
      a.sectionOrdinal - b.sectionOrdinal ||
      a.paragraphOrdinal - b.paragraphOrdinal ||
      ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin] ||
      compareText(a.problem, b.problem),
  );
}

/** Code-unit order: the same on every machine, unlike `localeCompare`. */
function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function countBySeverity(rows: readonly ReviewRow[]): Record<ReviewSeverity, number> {
  const counts: Record<ReviewSeverity, number> = {
    CRITIC: 0,
    MAJOR: 0,
    SURSA_POSIBIL_ERONATA: 0,
    MINOR: 0,
    INFO: 0,
  };
  for (const row of rows) counts[row.severity] += 1;
  return counts;
}

function cell(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function modelsLine(input: ReviewInput): string {
  const seen: Record<'draft' | 'critic' | 'revised', Set<string>> = {
    draft: new Set(),
    critic: new Set(),
    revised: new Set(),
  };
  for (const { data } of input.finals) seen[data.pass].add(data.model);
  for (const { data } of input.critics) seen.critic.add(data.model);
  return (['draft', 'critic', 'revised'] as const)
    .map((pass) => `${pass}: ${[...seen[pass]].sort().join(', ') || '-'}`)
    .join('; ');
}

/** The reviewer's sheet: a header and one table of open findings, ordered by risk. */
export function renderReview(input: ReviewInput, rows: readonly ReviewRow[]): string {
  const counts = countBySeverity(rows);
  // The sheet of an English translation is read by an English reviewer: the title, the columns of
  // the table and the empty message are English. The lines of the header always were.
  const english = input.targetLanguage === 'en';
  const lines = [
    `# ${english ? 'Review sheet' : 'Fișă de revizie'}: ${input.title}`,
    '',
    `- Work: ${input.titleOrig} (${input.slug})`,
    `- Languages: ${input.sourceLanguage} -> ${input.targetLanguage}`,
    `- Coverage: ${input.coverage.paragraphs[0]}/${input.coverage.paragraphs[1]} paragraphs, ` +
      `${input.coverage.sections[0]}/${input.coverage.sections[1]} sections`,
    `- Models: ${modelsLine(input)}`,
    `- Findings: ${REVIEW_SEVERITIES.map((s) => `${s} ${counts[s]}`).join(', ')}`,
    '',
    english
      ? '| Severity | Section | Paragraph (sourceId) | Source | Translation | Problem | Proposal | Origin |'
      : '| Severitate | Secțiune | Paragraf (sourceId) | Sursă | Traducere | Problemă | Propunere | Origine |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const section =
      row.sectionOrdinal === Number.MAX_SAFE_INTEGER ? '-' : String(row.sectionOrdinal + 1);
    const paragraph =
      row.sourceId === undefined ? '-' : `${row.paragraphOrdinal + 1} (${row.sourceId})`;
    lines.push(
      `| ${[row.severity, section, paragraph, cell(row.source), cell(row.target), cell(row.problem), cell(row.proposal), row.origin].join(' | ')} |`,
    );
  }
  if (rows.length === 0) {
    lines.push('', english ? 'No open findings.' : 'Nu există constatări deschise.');
  }
  return `${lines.join('\n')}\n`;
}
