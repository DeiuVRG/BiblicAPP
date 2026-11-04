import type { Pack } from '@biblioteca/shared';

import { DEFAULT_CHUNK, buildJobs } from './jobs';
import type {
  CheckReport,
  CriticReport,
  TranslationEditionMeta,
  TranslationJob,
  TranslationOutput,
} from './schemas';

/** Fixtures shared by the tests of the translation modules (not production code). */

export const SOURCE_EDITION_ID = 'edition-en';
export const SLUG = 'fixture-work';

/** Source paragraphs. Each has a clean Romanian rendering in `RO` that passes every check. */
export const EN: Record<string, string> = {
  'src-a1':
    'At the opening of his ministry Jesus announced that the kingdom of God was at hand, ' +
    'Matt. iv. 17; Mk. i. 15. This message stood at the center of his teaching for three years.',
  'src-a2':
    'The word for repentance, μετανοέω, denotes a change of mind, and the demand reaches all ' +
    'men alike, Lk. xiii. 3, 5.',
  'src-a3':
    'In 1903 many writers doubted this, but the older view, which the Gospels support, is clear.',
  'src-b1':
    'The church is the fellowship of those who enter the kingdom, cf. Matt. xvi. 18 and xviii. 17.',
  'src-b2':
    'Whoever is born from above sees the kingdom, as the words of Jesus to Nicodemus teach.',
};

export const RO: Record<string, string> = {
  'src-a1':
    'La începutul slujirii sale, Isus a vestit că Împărăția lui Dumnezeu este aproape, ' +
    'Mat. 4:17; Mc. 1:15. Acest mesaj a stat în centrul învățăturii sale timp de trei ani.',
  'src-a2':
    'Cuvântul pentru pocăință, μετανοέω, arată o schimbare a minții, iar cerința se adresează ' +
    'tuturor oamenilor deopotrivă, Lc. 13:3, 5.',
  'src-a3':
    'În 1903 mulți scriitori s-au îndoit de aceasta, dar vechea părere, pe care o susțin ' +
    'Evangheliile, este limpede.',
  'src-b1':
    'Biserica este comuniunea celor care intră în Împărăție, cf. Mat. 16:18 și 18:17.',
  'src-b2':
    'Cel născut de sus vede Împărăția, după cum arată cuvintele lui Isus către Nicodim.',
};

export const HEADING_RO: Record<string, string> = {
  'sec-a': 'I. Împărăția vestită',
  'sec-b': 'II. Biserica',
};

export function makeSource(): Pack {
  return {
    work: {
      id: 'work-1',
      slug: SLUG,
      titleRo: 'Lucrare de probă',
      titleOrig: 'Fixture work',
      author: { name: 'A. Author', born: 1862, died: 1949, tradition: 'protestant' },
      languageOrig: 'en',
      year: 1903,
    },
    edition: {
      id: SOURCE_EDITION_ID,
      language: 'en',
      kind: 'source',
      licence: { status: 'public-domain', note: 'Test text.' },
      provenance: { source: 'test', extractedBy: 'test', notes: 'Source notes.' },
    },
    sections: [
      { id: 'sec-a', ordinal: 0, kind: 'chapter', heading: 'I. The Kingdom Announced' },
      { id: 'sec-b', ordinal: 1, kind: 'chapter', heading: 'II. The Church' },
    ],
    paragraphs: Object.entries(EN).map(([id, text], index) => ({
      id,
      sectionId: id.startsWith('src-a') ? 'sec-a' : 'sec-b',
      ordinal: id.startsWith('src-a') ? index : index - 3,
      kind: 'p' as const,
      text,
    })),
  };
}

export function makeJobs(source: Pack = makeSource(), repoRoot = '/nonexistent-repo'): TranslationJob[] {
  return buildJobs({
    edition: source,
    targetLanguage: 'ro',
    chunk: DEFAULT_CHUNK,
    repoRoot,
    sourceSha256: '0'.repeat(64),
  }).jobs;
}

export function jobOf(ordinal: number): TranslationJob {
  const job = makeJobs()[ordinal];
  if (!job) throw new Error(`no job ${ordinal}`);
  return job;
}

/** A complete, clean rendering of a job. */
export function goodOutput(job: TranslationJob, pass: 'draft' | 'revised' = 'revised'): TranslationOutput {
  const heading = HEADING_RO[job.section.id];
  return {
    jobId: job.jobId,
    pass,
    model: 'claude-sonnet-5-5',
    ...(job.part === 0 && heading !== undefined ? { headingRo: heading } : {}),
    paragraphs: job.paragraphs.map((p) => ({ sourceId: p.id, text: RO[p.id] ?? '', flags: [] })),
  };
}

export function metaFor(overrides: { id?: string } = {}): TranslationEditionMeta {
  return {
    edition: {
      ...(overrides.id === undefined ? {} : { id: overrides.id }),
      language: 'ro',
      kind: 'translation',
      licence: { status: 'unknown', note: 'Traducere nouă, în curs de revizie.' },
      provenance: {
        source: 'Machine translation of edition-en, human review pending.',
        extractedBy: 'translation pipeline',
        notes: 'Draft.',
      },
      sourceEditionId: SOURCE_EDITION_ID,
    },
  };
}

export function criticReport(
  job: TranslationJob,
  findings: CriticReport['findings'],
): CriticReport {
  return {
    jobId: job.jobId,
    pass: 'critic',
    model: 'claude-sonnet-5-5',
    findings,
    verdict: findings.length === 0 ? 'ok' : 'revise',
  };
}

export function checkReport(job: TranslationJob, findings: CheckReport['findings'], file?: string): CheckReport {
  return {
    jobId: job.jobId,
    file: file ?? `final/${job.jobId}.json`,
    ok: !findings.some((f) => f.severity === 'CRITIC'),
    strictOk: !findings.some((f) => f.severity === 'CRITIC' || f.severity === 'MAJOR'),
    findings,
    stats: { paragraphs: job.paragraphs.length, sourceWords: 0, targetWords: 0, lengthRatio: 1 },
  };
}
