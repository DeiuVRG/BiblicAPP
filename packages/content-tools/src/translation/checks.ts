import { collapse, dice } from '../ingest/text';
import { ruleApplies } from './glossary';
import type { CalqueRule, GlossaryRule } from './glossary';
import {
  canonicalItems,
  compareReferences,
  detectNonRomanianNotation,
  extractTargetReferences,
  parseSourceReferences,
} from './references';
import { SEVERITY_RANK } from './schemas';
import type {
  CheckFinding,
  CheckReport,
  OutputParagraph,
  Severity,
  TranslationJob,
  TranslationOutput,
} from './schemas';
import { countWords, excerpt, head, joinList } from './text-utils';

export { loadCalques, loadGlossary, parseCalques, parseGlossary } from './glossary';
export type { CalqueRule, GlossaryRule } from './glossary';

/** Deterministic checks of a translation output against its job (specification, section 4). */

type JobParagraph = TranslationJob['paragraphs'][number];

export interface CheckInput {
  job: TranslationJob;
  output: TranslationOutput;
  /** Recorded in the report: the checked file, relative to the translation directory. */
  file: string;
  glossary: readonly GlossaryRule[];
  calques: readonly CalqueRule[];
  /** Tradition of the work, when known; selects the glossary rows that apply. */
  tradition?: string | undefined;
  /** Apply the safe auto-fixes (NFC, cedilla, whitespace) to the returned output. */
  fix: boolean;
}

export interface CheckResult {
  report: CheckReport;
  /** The output with the auto-fixes applied when `fix` is set, otherwise a copy of the input. */
  output: TranslationOutput;
  /** True when `fix` changed any text. */
  changed: boolean;
}

// Thresholds and word lists (fixed by the specification).
const SAME_AS_SOURCE_DICE = 0.9;
const LENGTH_MAJOR_LOW = 0.75;
const LENGTH_MAJOR_HIGH = 1.6;
const LENGTH_MINOR_LOW = 0.85;
const LENGTH_MINOR_HIGH = 1.45;
const RESIDUE_MIN_HITS = 4;
const RESIDUE_MIN_SHARE = 0.03;

// prettier-ignore
const ENGLISH_FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'of', 'which', 'that', 'with', 'this', 'is', 'not', 'from', 'by', 'his',
  'their', 'been', 'were', 'into', 'than', 'those', 'these', 'there', 'what', 'when', 'would',
  'should', 'also', 'only', 'but', 'upon', 'through', 'between', 'because', 'however',
]);

const CEDILLA_TO_COMMA: Record<string, string> = { ş: 'ș', ţ: 'ț', Ş: 'Ș', Ţ: 'Ț' };
const GREEK_RUN = /\p{Script=Greek}[\p{Script=Greek}\p{M}]*/gu;

// ---------------------------------------------------------------------------------------------
// Auto-fixable defects

export interface Normalised {
  text: string;
  /** The text was not in NFC. */
  nfc: boolean;
  /** Number of cedilla letters replaced by comma-below letters. */
  cedilla: number;
  /** Leading/trailing white space, runs of white space or line breaks were collapsed. */
  whitespace: boolean;
}

/**
 * NFC, cedilla letters to comma-below letters, white space collapsed and trimmed. A text that is
 * only white space is left alone (it is an EMPTY_TEXT finding, and an empty text is not valid).
 */
export function normaliseText(text: string): Normalised {
  const composed = text.normalize('NFC');
  let cedilla = 0;
  const commaBelow = composed.replace(/[şţŞŢ]/g, (letter) => {
    cedilla += 1;
    return CEDILLA_TO_COMMA[letter] ?? letter;
  });
  const collapsed = collapse(commaBelow);
  const whitespace = collapsed !== '' && collapsed !== commaBelow;
  return {
    text: whitespace ? collapsed : commaBelow,
    nfc: composed !== text,
    cedilla,
    whitespace,
  };
}

function fixableFindings(
  normalised: Normalised,
  autofixed: boolean,
  where: { sourceId?: string; label?: string },
): CheckFinding[] {
  const prefix = where.label ? `${where.label}: ` : '';
  const base = where.sourceId === undefined ? {} : { sourceId: where.sourceId };
  const findings: CheckFinding[] = [];
  const add = (check: string, message: string): void => {
    findings.push({ check, severity: 'MINOR', ...base, message: `${prefix}${message}`, autofixed });
  };
  if (normalised.cedilla > 0) {
    add('CEDILLA', `${normalised.cedilla} cedilla letter(s) (ş ţ Ş Ţ) replaced by comma-below letters`);
  }
  if (normalised.nfc) add('NFC', 'text was not in Unicode normalisation form NFC');
  if (normalised.whitespace) {
    add('WHITESPACE', 'leading/trailing white space, repeated white space or line breaks collapsed');
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// Per-paragraph checks

interface ParagraphContext {
  job: TranslationJob;
  jobParagraph: JobParagraph;
  /** The normalised translation of the paragraph. */
  text: string;
  source: string;
  sourceId: string;
  glossary: readonly GlossaryRule[];
  calques: readonly CalqueRule[];
  tradition: string | undefined;
}

function finding(
  ctx: { sourceId: string },
  check: string,
  severity: Severity,
  message: string,
  quotes: { quoteSource?: string | undefined; quoteTarget?: string | undefined } = {},
): CheckFinding {
  const result: CheckFinding = { check, severity, sourceId: ctx.sourceId, message };
  if (quotes.quoteSource !== undefined) result.quoteSource = quotes.quoteSource;
  if (quotes.quoteTarget !== undefined) result.quoteTarget = quotes.quoteTarget;
  return result;
}

function checkSameAsSource(ctx: ParagraphContext): CheckFinding[] {
  const source = collapse(ctx.source);
  const target = collapse(ctx.text);
  // A paragraph without letters (an ornament, a number) is legitimately identical.
  if (!/\p{L}/u.test(source)) return [];
  const similarity = source === target ? 1 : dice(source.toLowerCase(), target.toLowerCase());
  if (similarity < SAME_AS_SOURCE_DICE) return [];
  return [
    finding(ctx, 'SAME_AS_SOURCE', 'CRITIC', `translation is ${similarity.toFixed(2)} similar to the source (untranslated)`, {
      quoteSource: head(source),
      quoteTarget: head(target),
    }),
  ];
}

function checkGreek(ctx: ParagraphContext): CheckFinding[] {
  const target = ctx.text.normalize('NFC');
  const runs = new Set(ctx.source.normalize('NFC').match(GREEK_RUN) ?? []);
  const missing = [...runs].filter((run) => !target.includes(run));
  const first = missing[0];
  if (first === undefined) return [];
  return [
    finding(ctx, 'GREEK_MISSING', 'CRITIC', `Greek of the source missing from the translation: ${joinList(missing)}`, {
      quoteSource: first,
    }),
  ];
}

function checkResidue(ctx: ParagraphContext): CheckFinding[] {
  const tokens = [...ctx.text.matchAll(/\p{L}+/gu)];
  // Only whole ASCII words count, so Romanian words with diacritics never match.
  const hits = tokens.filter(
    (token) => /^[A-Za-z]+$/.test(token[0]) && ENGLISH_FUNCTION_WORDS.has(token[0].toLowerCase()),
  );
  const first = hits[0];
  if (!first) return [];
  const share = hits.length / tokens.length;
  if (hits.length < RESIDUE_MIN_HITS && share < RESIDUE_MIN_SHARE) return [];
  const counts = new Map<string, number>();
  for (const hit of hits) {
    const word = hit[0].toLowerCase();
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const listed = [...counts].map(([word, count]) => `${word} x${count}`);
  return [
    finding(
      ctx,
      'RESIDUE_EN',
      'MAJOR',
      `${hits.length} English function word(s) left in ${tokens.length} tokens: ${joinList(listed)}`,
      { quoteTarget: excerpt(ctx.text, first.index) },
    ),
  ];
}

function checkReferences(ctx: ParagraphContext): CheckFinding[] {
  const sourceItems = ctx.jobParagraph.references.flatMap((reference) => reference.canonical);
  const targetRuns = extractTargetReferences(ctx.text);
  const { missing, extra } = compareReferences(sourceItems, canonicalItems(targetRuns));
  const findings: CheckFinding[] = [];
  if (missing.length > 0) {
    const run = ctx.jobParagraph.references.find((r) => r.canonical.some((c) => missing.includes(c)));
    findings.push(
      finding(ctx, 'REF_MISSING', 'MAJOR', `scripture references missing from the translation: ${joinList(missing)}`, {
        quoteSource: run?.source,
      }),
    );
  }
  if (extra.length > 0) {
    const run = targetRuns.find((r) => r.canonical.some((c) => extra.includes(c)));
    findings.push(
      finding(ctx, 'REF_EXTRA', 'MAJOR', `scripture references not in the source: ${joinList(extra)}`, {
        quoteTarget: run?.text,
      }),
    );
  }
  return findings;
}

function checkLength(ctx: ParagraphContext): CheckFinding[] {
  const ratio = ctx.text.length / Math.max(1, ctx.source.length);
  let severity: Severity | null = null;
  if (ratio < LENGTH_MAJOR_LOW || ratio > LENGTH_MAJOR_HIGH) severity = 'MAJOR';
  else if (ratio < LENGTH_MINOR_LOW || ratio > LENGTH_MINOR_HIGH) severity = 'MINOR';
  if (severity === null) return [];
  const direction = ratio < 1 ? 'shorter' : 'longer';
  return [
    finding(ctx, 'LENGTH_RATIO', severity, `translation is ${direction} than expected: ${ratio.toFixed(2)} of the source length in characters`),
  ];
}

function calqueFindings(ctx: ParagraphContext, rules: readonly GlossaryRule[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (const calque of ctx.calques) {
    const match = calque.pattern.exec(ctx.text);
    if (!match) continue;
    const advice = calque.preferred ? `; prefer: ${calque.preferred}` : '';
    findings.push(
      finding(ctx, 'CALQUE', calque.level === 'FORBID' ? 'MAJOR' : 'MINOR', `calque ${calque.id}: "${match[0]}"${advice}`, {
        quoteTarget: match[0],
      }),
    );
  }
  for (const rule of rules) {
    if (rule.force !== 'FORBID' && rule.force !== 'WARN') continue;
    const match = rule.target.exec(ctx.text);
    if (!match || (rule.source && !rule.source.test(ctx.source))) continue;
    findings.push(
      finding(ctx, 'CALQUE', rule.force === 'FORBID' ? 'MAJOR' : 'MINOR', `glossary ${rule.termId} (${rule.force}): "${match[0]}"${rule.note ? `; ${rule.note}` : ''}`, {
        quoteSource: rule.source?.exec(ctx.source)?.[0],
        quoteTarget: match[0],
      }),
    );
  }
  return findings;
}

function checkRefFormat(ctx: ParagraphContext): CheckFinding[] {
  const fragments = detectNonRomanianNotation(ctx.text);
  const first = fragments[0];
  if (first === undefined) return [];
  return [
    finding(ctx, 'REF_FORMAT', 'MINOR', `reference not in Romanian notation: ${joinList(fragments)}`, {
      quoteTarget: first,
    }),
  ];
}

// `1,500` (English) and `1.500` (Romanian) are the same number: join thousands groups.
const THOUSANDS_SEPARATOR = new RegExp(
  `(?<=\\d)[.,${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}](?=\\d{3}(?!\\d))`,
  'g',
);

function numbersIn(text: string): string[] {
  return text.replace(THOUSANDS_SEPARATOR, '').match(/\d+/g) ?? [];
}

/** Numbers of the source outside scripture references. */
function numbersOutsideReferences(source: string): string[] {
  let blanked = source;
  for (const run of parseSourceReferences(source).reverse()) {
    blanked = blanked.slice(0, run.start) + ' '.repeat(run.end - run.start) + blanked.slice(run.end);
  }
  return [...new Set(numbersIn(blanked))];
}

function checkNumbers(ctx: ParagraphContext): CheckFinding[] {
  const present = new Set(numbersIn(ctx.text));
  const missing = numbersOutsideReferences(ctx.source).filter((n) => !present.has(n));
  const first = missing[0];
  if (first === undefined) return [];
  return [
    finding(ctx, 'NUMBER_MISSING', 'MINOR', `number(s) of the source missing from the translation: ${joinList(missing)}`, {
      quoteSource: first,
    }),
  ];
}

function checkGlossary(ctx: ParagraphContext, rules: readonly GlossaryRule[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (const rule of rules) {
    if (rule.force !== 'FIX' || !rule.source) continue;
    const match = rule.source.exec(ctx.source);
    if (!match || rule.target.test(ctx.text)) continue;
    findings.push(
      finding(ctx, 'GLOSSARY', 'MINOR', `glossary ${rule.termId}: expected a rendering matching /${rule.target.source}/${rule.note ? `; ${rule.note}` : ''}`, {
        quoteSource: match[0],
      }),
    );
  }
  return findings;
}

function checkQuotes(ctx: ParagraphContext): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const straight = ctx.text.indexOf('"');
  if (straight >= 0) {
    findings.push(
      finding(ctx, 'QUOTES_STRAIGHT', 'MINOR', 'straight quotation mark " in the translation (Romanian: „ and ”)', {
        quoteTarget: excerpt(ctx.text, straight),
      }),
    );
  }
  const english = ctx.text.indexOf('“');
  if (english >= 0) {
    findings.push(
      finding(ctx, 'QUOTES_ENGLISH', 'MINOR', 'English opening quotation mark “ (Romanian opens with „)', {
        quoteTarget: excerpt(ctx.text, english),
      }),
    );
  }
  const opening = ctx.text.split('„').length - 1;
  const closing = ctx.text.split('”').length - 1;
  if (opening !== closing) {
    findings.push(
      finding(ctx, 'QUOTES_UNBALANCED', 'MINOR', `${opening} opening „ but ${closing} closing ” quotation marks`),
    );
  }
  return findings;
}

function checkProposed(ctx: ParagraphContext, rules: readonly GlossaryRule[]): CheckFinding[] {
  const findings: CheckFinding[] = [];
  for (const rule of rules) {
    if (rule.status !== 'PROPUS') continue;
    const sourceMatch = rule.source?.exec(ctx.source) ?? null;
    const targetMatch = rule.target.exec(ctx.text);
    // A row with a source pattern is matched by the source; a row without one by the target.
    if (rule.source ? !sourceMatch : !targetMatch) continue;
    findings.push(
      finding(ctx, 'FLAG_PROPOSED', 'INFO', `proposed (not approved) glossary row ${rule.termId} (${rule.force}) matched${rule.note ? `: ${rule.note}` : ''}`, {
        quoteSource: sourceMatch?.[0],
        quoteTarget: targetMatch?.[0],
      }),
    );
  }
  return findings;
}

function paragraphChecks(ctx: ParagraphContext): CheckFinding[] {
  const rules = ctx.glossary.filter((rule) => ruleApplies(rule, ctx.job.workSlug, ctx.tradition));
  return [
    ...checkSameAsSource(ctx),
    ...checkGreek(ctx),
    ...checkResidue(ctx),
    ...checkReferences(ctx),
    ...checkLength(ctx),
    ...calqueFindings(ctx, rules),
    ...checkRefFormat(ctx),
    ...checkNumbers(ctx),
    ...checkGlossary(ctx, rules),
    ...checkQuotes(ctx),
    ...checkProposed(ctx, rules),
  ];
}

// ---------------------------------------------------------------------------------------------
// Whole-output checks

function parityFindings(job: TranslationJob, output: TranslationOutput): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const jobIds = new Set(job.paragraphs.map((p) => p.id));
  const outputIds = new Set(output.paragraphs.map((p) => p.sourceId));
  for (const paragraph of job.paragraphs) {
    if (!outputIds.has(paragraph.id)) {
      findings.push({
        check: 'PARITY_MISSING',
        severity: 'CRITIC',
        sourceId: paragraph.id,
        message: `no output for source paragraph ${paragraph.ordinal + 1} of the section`,
        quoteSource: head(paragraph.text),
      });
    }
  }
  const counts = new Map<string, number>();
  for (const paragraph of output.paragraphs) {
    counts.set(paragraph.sourceId, (counts.get(paragraph.sourceId) ?? 0) + 1);
  }
  for (const [sourceId, count] of counts) {
    if (!jobIds.has(sourceId)) {
      findings.push({
        check: 'PARITY_EXTRA',
        severity: 'CRITIC',
        sourceId,
        message: 'the output has a paragraph whose sourceId is not in the job',
      });
    } else if (count > 1) {
      findings.push({
        check: 'PARITY_DUPLICATE',
        severity: 'CRITIC',
        sourceId,
        message: `the sourceId appears ${count} times in the output`,
      });
    }
  }
  return findings;
}

function flagCriticFindings(paragraph: OutputParagraph): CheckFinding[] {
  return paragraph.flags
    .filter((flag) => flag.severity === 'CRITIC')
    .map((flag) => {
      const result: CheckFinding = {
        check: 'FLAG_CRITIC',
        severity: 'CRITIC',
        sourceId: paragraph.sourceId,
        message: `[${flag.code}] ${flag.note}`,
      };
      if (flag.quoteSource !== undefined) result.quoteSource = flag.quoteSource;
      if (flag.quoteTarget !== undefined) result.quoteTarget = flag.quoteTarget;
      return result;
    });
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Runs every check of section 4 and returns the report (and the fixed output with `fix`). */
export function checkOutput(input: CheckInput): CheckResult {
  const { job, fix } = input;
  const output = structuredClone(input.output);
  const jobById = new Map(job.paragraphs.map((p) => [p.id, p]));
  const findings: CheckFinding[] = parityFindings(job, output);
  let changed = false;

  const heading = output.headingRo;
  if (job.part === 0 && (heading === undefined || heading.trim() === '')) {
    findings.push({
      check: 'HEADING_MISSING',
      severity: 'MAJOR',
      message: 'part 0 of the section must carry headingRo (the translated heading)',
      quoteSource: job.section.heading,
    });
  }

  const seen = new Set<string>();
  let sourceChars = 0;
  let targetChars = 0;
  let targetWords = 0;
  for (const paragraph of output.paragraphs) {
    const normalised = normaliseText(paragraph.text);
    const first = !seen.has(paragraph.sourceId);
    seen.add(paragraph.sourceId);
    targetWords += countWords(normalised.text);
    const jobParagraph = jobById.get(paragraph.sourceId);
    const ctx = { sourceId: paragraph.sourceId };

    if (normalised.text.trim() === '') {
      findings.push(finding(ctx, 'EMPTY_TEXT', 'CRITIC', 'the translation is empty or only white space'));
    } else if (jobParagraph && first) {
      sourceChars += jobParagraph.text.length;
      targetChars += normalised.text.length;
      findings.push(
        ...paragraphChecks({
          job,
          jobParagraph,
          text: normalised.text,
          source: jobParagraph.text,
          sourceId: paragraph.sourceId,
          glossary: input.glossary,
          calques: input.calques,
          tradition: input.tradition,
        }),
      );
    }
    findings.push(...flagCriticFindings(paragraph));
    findings.push(...fixableFindings(normalised, fix, ctx));
    if (fix && normalised.text !== paragraph.text) {
      paragraph.text = normalised.text;
      changed = true;
    }
  }

  if (heading !== undefined) {
    const normalised = normaliseText(heading);
    findings.push(...fixableFindings(normalised, fix, { label: 'headingRo' }));
    if (fix && normalised.text !== heading) {
      output.headingRo = normalised.text;
      changed = true;
    }
  }

  findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const ok = !findings.some((f) => f.severity === 'CRITIC');
  const strictOk = ok && !findings.some((f) => f.severity === 'MAJOR');
  const report: CheckReport = {
    jobId: job.jobId,
    file: input.file,
    ok,
    strictOk,
    findings,
    stats: {
      paragraphs: job.paragraphs.length,
      sourceWords: job.paragraphs.reduce((sum, p) => sum + countWords(p.text), 0),
      targetWords,
      lengthRatio: sourceChars === 0 ? 0 : round(targetChars / sourceChars, 3),
    },
  };
  return { report, output, changed };
}
