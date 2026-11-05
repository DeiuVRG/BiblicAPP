import fs from 'node:fs';

import type { Pack } from '@biblioteca/shared';

import { DEFAULT_CHUNK, buildJobs } from '../jobs';
import type { TranslationEditionMeta, TranslationJob, TranslationOutput } from '../schemas';

/**
 * The fixtures of the dry runs of P1-C2 (not production code): the Latin of the first chapter of
 * Augustine's De spiritu et littera and the Greek of the Creed of Constantinople, each with a test
 * translation into English and into Romanian (README.md of this directory has the provenance).
 */

const HERE = new URL('./', import.meta.url);

function lines(name: string): string[] {
  return fs.readFileSync(new URL(name, HERE), 'utf8').replace(/\n$/, '').split('\n');
}

export const AUGUSTINE_SLUG = 'augustine-de-spiritu-et-littera';
export const CREED_SLUG = 'symbolum-nicaeno-constantinopolitanum';

/** The one paragraph of chapter I of the treatise, in Latin and in the two test translations. */
export const AUGUSTINE = {
  la: lines('augustine-de-spiritu-et-littera.ch1.la.txt').join(' '),
  en: lines('augustine-de-spiritu-et-littera.ch1.en.txt').join(' '),
  ro: lines('augustine-de-spiritu-et-littera.ch1.ro.txt').join(' '),
  heading: { la: 'Caput I', en: 'Chapter I', ro: 'Capitolul I' },
} as const;

/** The three articles of the creed, in Greek (NFC, polytonic) and in the two test translations. */
export const CREED = {
  grc: lines('symbolum-nicaeno-constantinopolitanum.grc.txt'),
  en: lines('symbolum-nicaeno-constantinopolitanum.en.txt'),
  ro: lines('symbolum-nicaeno-constantinopolitanum.ro.txt'),
  heading: {
    grc: ['Ἄρθρον α΄', 'Ἄρθρον β΄', 'Ἄρθρον γ΄'],
    en: ['Article I: the Father', 'Article II: the Son', 'Article III: the Holy Spirit'],
    ro: ['Articolul I: Tatăl', 'Articolul II: Fiul', 'Articolul III: Duhul Sfânt'],
  },
} as const;

const PROVENANCE = {
  source: 'Test fixture of packages/content-tools (see src/translation/fixtures/README.md).',
  extractedBy: 'test',
  notes: '',
};

export function augustineSource(): Pack {
  return {
    work: {
      id: 'work-augustine',
      slug: AUGUSTINE_SLUG,
      titleRo: 'Despre spirit și literă',
      titleOrig: 'De spiritu et littera',
      titleEn: 'On the Spirit and the Letter',
      author: { name: 'Augustine of Hippo', born: 354, died: 430, tradition: 'undivided' },
      languageOrig: 'la',
      year: 412,
    },
    edition: {
      id: 'edition-la',
      language: 'la',
      kind: 'source',
      licence: { status: 'public-domain', note: 'Latin text of a work of 412.' },
      provenance: PROVENANCE,
    },
    sections: [{ id: 'sec-1', ordinal: 0, kind: 'chapter', heading: AUGUSTINE.heading.la }],
    paragraphs: [{ id: 'par-1', sectionId: 'sec-1', ordinal: 0, kind: 'p', text: AUGUSTINE.la }],
  };
}

export function creedSource(): Pack {
  return {
    work: {
      id: 'work-creed',
      slug: CREED_SLUG,
      titleRo: 'Simbolul niceo-constantinopolitan',
      titleOrig: 'Σύμβολον τῆς Πίστεως',
      titleEn: 'The Nicene-Constantinopolitan Creed',
      author: {
        name: 'First Council of Constantinople (381)',
        born: null,
        died: null,
        tradition: 'undivided',
      },
      languageOrig: 'grc',
      year: 381,
    },
    edition: {
      id: 'edition-grc',
      language: 'grc',
      kind: 'source',
      licence: { status: 'public-domain', note: 'Greek text of 381.' },
      provenance: PROVENANCE,
    },
    sections: CREED.grc.map((_, i) => ({
      id: `sec-${i + 1}`,
      ordinal: i,
      kind: 'section' as const,
      heading: CREED.heading.grc[i] ?? '',
    })),
    paragraphs: CREED.grc.map((text, i) => ({
      id: `par-${i + 1}`,
      sectionId: `sec-${i + 1}`,
      ordinal: 0,
      kind: 'p' as const,
      text,
    })),
  };
}

export function jobsFor(source: Pack, targetLanguage: 'en' | 'ro'): TranslationJob[] {
  return buildJobs({
    edition: source,
    targetLanguage,
    chunk: DEFAULT_CHUNK,
    repoRoot: new URL('../../../../../', import.meta.url).pathname,
    sourceSha256: '0'.repeat(64),
  }).jobs;
}

/** A final output for a job: the given texts in the order of the job, the heading in part 0. */
export function finalOutput(
  job: TranslationJob,
  texts: readonly string[],
  heading: string | undefined,
): TranslationOutput {
  const field = job.targetLanguage === 'en' ? 'headingEn' : 'headingRo';
  return {
    jobId: job.jobId,
    pass: 'revised',
    model: 'claude-sonnet-5-5',
    ...(job.part === 0 && heading !== undefined ? { [field]: heading } : {}),
    paragraphs: job.paragraphs.map((p, i) => ({
      sourceId: p.id,
      text: texts[i] ?? '',
      flags: [],
    })),
  };
}

export function translationMeta(
  sourceEditionId: string,
  language: 'en' | 'ro',
  workTitle?: string,
): TranslationEditionMeta {
  return {
    ...(workTitle === undefined ? {} : { workTitle }),
    edition: {
      language,
      kind: 'translation',
      licence: { status: 'unknown', note: 'Test translation.' },
      provenance: { source: 'test', extractedBy: 'test', notes: 'Test.' },
      sourceEditionId,
    },
  };
}
