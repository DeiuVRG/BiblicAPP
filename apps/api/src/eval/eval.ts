import { createHash } from 'node:crypto';

import { z } from 'zod';

import { MockProvider } from '../ai/mock';
import { collectAnswer, runAsk } from '../ask/pipeline';
import { UsageLedger } from '../ask/usage';
import { sourceSectionOrdinal } from '../library/library';
import type { Library } from '../library/library';
import type { LoadedPack } from '../library/packs';
import { silentLogger } from '../logger';
import { LogHasher } from '../privacy';
import type { Language } from '../types';

// The evaluation set of Ask and its structural checks. The questions go through the real pipeline
// (retrieval, prompt, citation tracking, quotation check) with the mock provider, which answers
// deterministically by quoting and citing the first two sources. What this measures is therefore
// the retrieval and the plumbing: the quality of a real model's answers needs `AI_PROVIDER=claude`
// and a key, and is not measured here (docs/ask-api.md, Evaluation).

const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const EvalQuestionSchema = z.strictObject({
  /** `ro-01`, `en-14`: the language and the number inside it. */
  id: z.string().regex(/^(ro|en)-\d{2}$/),
  language: z.enum(['ro', 'en']),
  /** Names the subject. A topic asked in both languages is a pair: the gap between them is reported. */
  topic: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  question: z.string().trim().min(1).max(2000),
  /** The work(s) that hold the answer. */
  expectedWorkIds: z.array(IdSchema).min(1),
  /** The sections (ordinals in the source edition, from 0) that answer it; absent when no section does. */
  expectedSectionOrdinals: z.array(z.number().int().min(0)).min(1).optional(),
});

export const EvalSetSchema = z
  .strictObject({
    version: z.literal(0),
    description: z.string().min(1),
    questions: z.array(EvalQuestionSchema).min(1),
  })
  .superRefine((set, context) => {
    const seen = new Set<string>();
    set.questions.forEach((question, index) => {
      if (seen.has(question.id)) {
        context.addIssue({
          code: 'custom',
          path: ['questions', index, 'id'],
          message: `duplicate id ${question.id}`,
        });
      }
      seen.add(question.id);
      if (!question.id.startsWith(`${question.language}-`)) {
        context.addIssue({
          code: 'custom',
          path: ['questions', index, 'id'],
          message: `${question.id} does not belong to the language ${question.language}`,
        });
      }
    });
    for (const language of ['ro', 'en'] as const) {
      const topics = set.questions.filter((q) => q.language === language).map((q) => q.topic);
      if (new Set(topics).size !== topics.length) {
        context.addIssue({
          code: 'custom',
          path: ['questions'],
          message: `a topic is asked twice in ${language}`,
        });
      }
    }
  });

export type EvalQuestion = z.infer<typeof EvalQuestionSchema>;
export type EvalSet = z.infer<typeof EvalSetSchema>;

/** Parses the evaluation set, or throws with every problem listed. */
export function parseEvalSet(json: unknown): EvalSet {
  const parsed = EvalSetSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Invalid evaluation set:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.') || 'set'}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------------------------
// Results

export interface QuestionResult {
  id: string;
  language: Language;
  topic: string;
  /** Number of sources the answer was built on. */
  sources: number;
  /** The works of the sources, in order of first appearance. */
  works: string[];
  /** The sections (ordinals in the source edition) of the sources, in order of first appearance. */
  sections: number[];
  /** How many sources are shown in each language (Romanian questions find English passages too). */
  shown: Record<string, number>;
  /** An expected work is among the sources. */
  expectedWorkHit: boolean;
  /** A source is in an expected section; `null` when the question names none. */
  expectedSectionHit: boolean | null;
  /** 1-based position of the first source in an expected section; `null` when none (or none expected). */
  firstExpectedRank: number | null;
  /** Valid citations in the answer. */
  citations: number;
  /** Markers that named no source. */
  invalidCitations: number;
  quotations: { checked: number; unverified: number; uncited: number };
  stopReason: string;
}

export interface Rate {
  passed: number;
  total: number;
  /** passed / total, to four decimals (0 when total is 0). */
  rate: number;
}

export interface Summary {
  questions: number;
  /** The question found at least one source. */
  sourcesPresent: Rate;
  /** The answer has at least one valid citation. */
  withCitation: Rate;
  /** Every `[n]` of the answer names a source. */
  citationsInRange: Rate;
  /** No quotation of the answer is unverified. */
  quotationsVerified: Rate;
  expectedWorkHit: Rate;
  /** Among the questions that name expected sections. */
  expectedSectionHit: Rate;
  /** The same, counting only the first three sources. */
  expectedSectionTop3: Rate;
  /** Mean reciprocal rank of the first source in an expected section (0 for none). */
  sectionMrr: number;
}

export interface Gate {
  name: string;
  /** What the check measures, in a sentence. */
  meaning: string;
  value: number;
  threshold: number;
  pass: boolean;
}

export interface EvalReport {
  report: 'eval-v0';
  provider: 'mock';
  note: string;
  evalSet: { file: string; sha256: string; questions: number };
  library: {
    packs: Array<{ packId: string; revision: number; sha256: string }>;
    works: number;
    editions: number;
    paragraphs: number;
  };
  summary: { all: Summary; ro: Summary; en: Summary };
  /** The questions asked in both languages, compared on the sections they should reach. */
  languageGap: {
    pairs: number;
    bothHit: number;
    onlyEnglishHit: number;
    onlyRomanianHit: number;
    neitherHit: number;
  };
  gates: Gate[];
  ok: boolean;
  questions: QuestionResult[];
}

export const REPORT_NOTE =
  'Structural checks with the mock provider, which cites [1] and [2] and quotes the first two sources word for word: sources, valid citations and verified quotations hold by construction and fail only if the pipeline breaks; the expected work and section rates measure retrieval. The gates of docs/roadmap-v2.md 3.3 for the real model (90 % of answers with a valid citation, 95 % without an unverified quotation) need AI_PROVIDER=claude and are not measured here.';

/** Minimum shares for the gates; the first two are the exit criteria of docs/roadmap-v2.md 3.3. */
export const GATES = {
  withCitation: 0.9,
  quotationsVerified: 0.95,
  sourcesPresent: 1,
} as const;

/** Plain code-unit order: the report must not depend on the locale of the machine that wrote it. */
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function rate(passed: number, total: number): Rate {
  return { passed, total, rate: total === 0 ? 0 : round(passed / total) };
}

export function summarise(results: readonly QuestionResult[]): Summary {
  const withSections = results.filter((result) => result.expectedSectionHit !== null);
  const ranked = withSections.map((result) =>
    result.firstExpectedRank === null ? 0 : 1 / result.firstExpectedRank,
  );
  return {
    questions: results.length,
    sourcesPresent: rate(results.filter((r) => r.sources > 0).length, results.length),
    withCitation: rate(results.filter((r) => r.citations > 0).length, results.length),
    citationsInRange: rate(results.filter((r) => r.invalidCitations === 0).length, results.length),
    quotationsVerified: rate(
      results.filter((r) => r.quotations.unverified === 0).length,
      results.length,
    ),
    expectedWorkHit: rate(results.filter((r) => r.expectedWorkHit).length, results.length),
    expectedSectionHit: rate(
      withSections.filter((r) => r.expectedSectionHit === true).length,
      withSections.length,
    ),
    expectedSectionTop3: rate(
      withSections.filter((r) => r.firstExpectedRank !== null && r.firstExpectedRank <= 3).length,
      withSections.length,
    ),
    sectionMrr:
      ranked.length === 0
        ? 0
        : round(ranked.reduce((sum, value) => sum + value, 0) / ranked.length),
  };
}

export function evaluateGates(summary: Summary): Gate[] {
  const gate = (name: keyof typeof GATES, meaning: string): Gate => ({
    name,
    meaning,
    value: summary[name].rate,
    threshold: GATES[name],
    pass: summary[name].rate >= GATES[name],
  });
  return [
    gate('sourcesPresent', 'every question finds at least one passage to answer from'),
    gate('withCitation', 'answers with at least one valid citation'),
    gate('quotationsVerified', 'answers without an unverified quotation'),
  ];
}

/** Compares the questions asked in both languages on whether they reach their expected sections. */
export function languageGap(results: readonly QuestionResult[]): EvalReport['languageGap'] {
  const gap = { pairs: 0, bothHit: 0, onlyEnglishHit: 0, onlyRomanianHit: 0, neitherHit: 0 };
  const english = new Map(results.filter((r) => r.language === 'en').map((r) => [r.topic, r]));
  for (const romanian of results.filter((r) => r.language === 'ro')) {
    const counterpart = english.get(romanian.topic);
    if (
      counterpart === undefined ||
      counterpart.expectedSectionHit === null ||
      romanian.expectedSectionHit === null
    ) {
      continue;
    }
    gap.pairs += 1;
    if (counterpart.expectedSectionHit && romanian.expectedSectionHit) gap.bothHit += 1;
    else if (counterpart.expectedSectionHit) gap.onlyEnglishHit += 1;
    else if (romanian.expectedSectionHit) gap.onlyRomanianHit += 1;
    else gap.neitherHit += 1;
  }
  return gap;
}

/** Runs one question through the pipeline with the mock provider. */
async function evaluateQuestion(library: Library, question: EvalQuestion): Promise<QuestionResult> {
  const events = runAsk(
    {
      library,
      provider: new MockProvider(),
      logger: silentLogger,
      hasher: new LogHasher('evaluation-set-v0-fixed-salt'),
      ledger: new UsageLedger(),
    },
    { question: question.question, language: question.language, conversation: [] },
    {
      requestId: `eval-${question.id}`,
      clientHash: 'eval',
      signal: new AbortController().signal,
    },
  );
  const result = await collectAnswer(events);
  const expectedSections = new Set(question.expectedSectionOrdinals ?? []);
  const base = { id: question.id, language: question.language, topic: question.topic };
  if (!result.ok) {
    return {
      ...base,
      sources: 0,
      works: [],
      sections: [],
      shown: {},
      expectedWorkHit: false,
      expectedSectionHit: question.expectedSectionOrdinals === undefined ? null : false,
      firstExpectedRank: null,
      citations: 0,
      invalidCitations: 0,
      quotations: { checked: 0, unverified: 0, uncited: 0 },
      stopReason: `error:${result.error.code}`,
    };
  }
  const { sources, citations, done } = result.value;
  const works: string[] = [];
  const sections: number[] = [];
  const shown: Record<string, number> = {};
  let firstExpectedRank: number | null = null;
  sources.forEach((source, index) => {
    if (!works.includes(source.workId)) works.push(source.workId);
    const paragraph = library.paragraphsById.get(source.paragraphId);
    const section = paragraph === undefined ? undefined : sourceSectionOrdinal(library, paragraph);
    if (section !== undefined && !sections.includes(section)) sections.push(section);
    shown[source.language] = (shown[source.language] ?? 0) + 1;
    if (firstExpectedRank === null && section !== undefined && expectedSections.has(section)) {
      firstExpectedRank = index + 1;
    }
  });
  return {
    ...base,
    sources: sources.length,
    works,
    sections,
    shown: Object.fromEntries(Object.entries(shown).sort(([a], [b]) => compareText(a, b))),
    expectedWorkHit: question.expectedWorkIds.some((id) => works.includes(id)),
    expectedSectionHit:
      question.expectedSectionOrdinals === undefined ? null : firstExpectedRank !== null,
    firstExpectedRank,
    citations: citations.length,
    invalidCitations: done.invalidCitations,
    quotations: {
      checked: done.quotations.checked,
      unverified: done.quotations.unverified,
      uncited: done.quotations.uncited,
    },
    stopReason: done.stopReason,
  };
}

export interface RunOptions {
  /** Where the evaluation set lives, as the report names it (a repository-relative path). */
  file: string;
  /** The bytes of the evaluation set file: their hash ties the report to the questions. */
  bytes: Uint8Array;
  /** The packs the library was built from: their hashes tie the report to the content. */
  packs: readonly LoadedPack[];
}

/**
 * Runs every question of the set and builds the report. The report has no timestamps, no request
 * ids and no scores, and the mock provider is deterministic, so the same questions on the same
 * packs give the same report byte for byte.
 */
export async function runEval(
  library: Library,
  set: EvalSet,
  options: RunOptions,
): Promise<EvalReport> {
  const results: QuestionResult[] = [];
  for (const question of set.questions) results.push(await evaluateQuestion(library, question));
  const summary = {
    all: summarise(results),
    ro: summarise(results.filter((result) => result.language === 'ro')),
    en: summarise(results.filter((result) => result.language === 'en')),
  };
  const gates = evaluateGates(summary.all);
  return {
    report: 'eval-v0',
    provider: 'mock',
    note: REPORT_NOTE,
    evalSet: {
      file: options.file,
      sha256: createHash('sha256').update(options.bytes).digest('hex'),
      questions: set.questions.length,
    },
    library: {
      packs: options.packs
        .map(({ manifest }) => ({
          packId: manifest.packId,
          revision: manifest.revision,
          sha256: manifest.sha256,
        }))
        .sort((a, b) => compareText(a.packId, b.packId)),
      works: library.workCount,
      editions: library.editionCount,
      paragraphs: library.paragraphCount,
    },
    summary,
    languageGap: languageGap(results),
    gates,
    ok: gates.every((gate) => gate.pass),
    questions: results,
  };
}

/** The report as written to `content/ask/eval-v0.report.json`. */
export function serialiseReport(report: EvalReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
