import type { Edition } from '@biblioteca/shared';

import { resolveProvenance } from '@/content/provenance';
import {
  buttonLabel,
  checkLines,
  factsLine,
  leadNote,
  passesText,
  reportMailHref,
  reviewSentence,
  statusChipLabel,
  transcriptionNote,
} from '@/features/transparency/transparency-text';
import { en } from '@/i18n/en';
import { ro } from '@/i18n/ro';

// The kinds of provenance of docs/ui-spec-v2.md, 8.6 (checks T1 and T2, T4 for the mail): what each one
// says in Romanian and in English.

const edition = (
  language: string,
  kind: Edition['kind'],
  provenance: Partial<Edition['provenance']> = {},
): Edition => ({
  id: 'e',
  language,
  kind,
  licence: { status: 'licensed', note: '' },
  provenance: { source: '', extractedBy: '', notes: '', ...provenance },
});

const FIXTURES = {
  ai: edition('ro', 'translation', {
    kind: 'ai',
    sourceLanguage: 'en',
    model: 'claude-sonnet-5-5',
    generatedAt: '2026-11-05',
    passes: ['draft', 'critic', 'revision'],
    checks: [
      { code: 'parity', status: 'passed' },
      { code: 'glossary', status: 'flagged', flags: 4 },
    ],
  }),
  human: edition('ro', 'translation', { kind: 'human' }),
  native: edition('en', 'source', { kind: 'native' }),
  source: edition('la', 'source', {
    kind: 'source',
    sourceDescription: 'A scan of the Maurist edition.',
  }),
  transcription: edition('la', 'source', { source: 'OCR text layer of a scan' }),
  unknown: edition('ro', 'translation'),
} as const;

const resolve = (key: keyof typeof FIXTURES) => resolveProvenance(FIXTURES[key]);

describe('the lead note of each kind (T1)', () => {
  it.each([
    [
      'ai',
      'Această traducere a fost făcută de o mașină.',
      'This translation was made by a machine.',
    ],
    ['human', 'Această traducere a fost făcută de oameni.', 'This translation was made by people.'],
    ['native', 'Această lucrare a fost scrisă în engleză.', 'This work was written in English.'],
    ['source', 'Acesta este textul original.', 'This is the original text.'],
    [
      'transcription',
      'Aceasta este o transcriere a ediției tipărite, nu o traducere.',
      'This is a transcription of the printed edition, not a translation.',
    ],
    [
      'unknown',
      'Nu am înregistrat încă cum a fost făcut acest text.',
      'We have not recorded how this text was made yet.',
    ],
  ] as const)('says "%s" in both languages', (key, inRo, inEn) => {
    const resolved = resolve(key);
    expect(leadNote(resolved, FIXTURES[key], 'en', ro).lead).toBe(inRo);
    expect(leadNote(resolved, FIXTURES[key], 'en', en).lead).toBe(inEn);
  });

  it('names the source language of a machine translation and tells the reader how to check it', () => {
    const resolved = resolve('ai');
    const note = leadNote(resolved, FIXTURES.ai, 'en', ro);
    expect(note.body).toContain(
      'Textul în română a fost produs cu inteligență artificială din engleză.',
    );
    expect(note.body).toContain('„Alăturat”');
    expect(leadNote(resolved, FIXTURES.ai, 'en', en).body).toContain(
      'The Romanian text was produced with artificial intelligence from English.',
    );
  });

  it('uses the description of a source edition, and the credit of a human translation or its absence', () => {
    expect(leadNote(resolve('source'), FIXTURES.source, 'la', en).body).toBe(
      'A scan of the Maurist edition.',
    );
    expect(leadNote(resolve('human'), FIXTURES.human, 'en', ro).body).toContain(
      'Numele traducătorului nu este încă înregistrat.',
    );
    expect(leadNote(resolve('human'), FIXTURES.human, 'en', ro).body).toContain(
      'Nu s-a folosit inteligență artificială.',
    );
  });

  it('adds the second note under a native or a source edition that is also a transcription, and under no other', () => {
    const native = resolveProvenance(
      edition('en', 'source', { kind: 'native', transcription: true }),
    );
    expect(transcriptionNote(native, ro)?.lead).toBe(
      'Aceasta este o transcriere a ediției tipărite, nu o traducere.',
    );
    expect(transcriptionNote(native, en)?.body).toContain('has not been fully collated');
    const source = resolveProvenance(
      edition('la', 'source', { kind: 'source', transcription: true }),
    );
    expect(transcriptionNote(source, ro)).not.toBeNull();
    // A lead that is itself the transcription has no second note, and an edition without the flag none.
    expect(transcriptionNote(resolve('transcription'), ro)).toBeNull();
    expect(transcriptionNote(resolve('native'), ro)).toBeNull();
  });
});

describe('the facts line, the chip and the button', () => {
  it('reads "Tradusă cu AI din engleză · Neverificată" for the Romanian Vos edition', () => {
    expect(factsLine(resolve('ai'), FIXTURES.ai, ro)).toBe(
      'Tradusă cu AI din engleză · Neverificată',
    );
    expect(factsLine(resolve('ai'), FIXTURES.ai, en)).toBe(
      'AI translated from English · Needs review',
    );
    expect(factsLine(resolve('native'), FIXTURES.native, ro)).toBe(
      'Scrisă în engleză · Neverificată',
    );
  });

  it('writes the chip by kind: machine translation, translation, original text', () => {
    expect(statusChipLabel(resolve('ai'), ro)).toBe('Traducere AI · Neverificată');
    expect(statusChipLabel(resolve('ai'), en)).toBe('AI translation · Needs review');
    expect(statusChipLabel(resolve('human'), ro)).toBe('Traducere · Neverificată');
    expect(statusChipLabel(resolve('native'), ro)).toBe('Text original');
    expect(statusChipLabel(resolve('source'), en)).toBe('Original text');
    const reviewed = resolveProvenance(
      edition('ro', 'translation', {
        kind: 'human',
        review: { state: 'reviewed', at: '2027-01-10', roleNote: 'teolog și filolog' },
      }),
    );
    expect(statusChipLabel(reviewed, ro)).toBe('Traducere · Verificată');
  });

  it('calls the toolbar button "Transparență AI" for a machine translation and "Transparență" for the rest', () => {
    expect(buttonLabel(resolve('ai'), ro)).toBe('Transparență AI');
    expect(buttonLabel(resolve('ai'), en)).toBe('AI transparency');
    expect(buttonLabel(resolve('native'), ro)).toBe('Transparență');
    expect(buttonLabel(resolve('human'), en)).toBe('Transparency');
  });
});

describe('the review row (T2)', () => {
  it('names a reviewer for a translation and an editor for any other text, with the role only once reviewed', () => {
    const none = resolve('ai');
    expect(reviewSentence(none, true, ro)).toBe(
      'Niciun revizor nu a citit încă traducerea față de original.',
    );
    expect(reviewSentence(resolve('native'), false, ro)).toBe(
      'Niciun redactor nu a citit încă lucrarea față de sursă.',
    );
    const done = resolveProvenance(
      edition('ro', 'translation', {
        kind: 'ai',
        review: { state: 'reviewed', at: '2027-01-10', roleNote: 'teolog, filolog' },
      }),
    );
    expect(reviewSentence(done, true, ro)).toBe(
      'Un revizor (teolog, filolog) a citit traducerea față de original la 10 ianuarie 2027.',
    );
    expect(reviewSentence(done, true, en)).toBe(
      'A reviewer (teolog, filolog) read the translation against the original on 10 January 2027.',
    );
    expect(reviewSentence(done, false, en)).toContain('An editor');
  });
});

describe('the translation row', () => {
  it('lists the passes by name and the checks with what they left open', () => {
    const resolved = resolve('ai');
    expect(passesText(resolved, ro)).toBe('Etape: ciornă, critic independent, revizie');
    expect(passesText(resolved, en)).toBe('Passes: draft, independent critic, revision');
    expect(passesText(resolve('human'), ro)).toBeNull();
    expect(checkLines(resolved, ro)).toEqual([
      { code: 'parity', name: 'paritate de paragrafe', result: 'fără semnalări', flagged: false },
      { code: 'glossary', name: 'glosar', result: '4 semnalări deschise', flagged: true },
    ]);
    expect(checkLines(resolved, en)[1]!.result).toBe('4 open flags');
  });
});

describe('the mail of a report (T4)', () => {
  const decode = (href: string) => {
    const query = href.slice(href.indexOf('?') + 1);
    const params = Object.fromEntries(
      query.split('&').map((pair) => pair.split('=').map(decodeURIComponent) as [string, string]),
    );
    return { subject: params.subject!, body: params.body! };
  };

  it('carries the type line, the ids of the edition, of the open paragraph and of its source paragraph, and the citation', () => {
    const href = reportMailHref(
      {
        title: 'Învățătura lui Isus',
        editionId: 'E-RO',
        language: 'ro',
        sourceEditionId: 'E-EN',
        sectionId: 'S1',
        paragraphId: 'P-RO-7',
        sourceParagraphId: 'P-EN-7',
        citation:
          '— Geerhardus Vos, Titlu, I. Introducere (ediția română). — https://x.test/read/w/S1?p=P-RO-7',
      },
      ro,
      'raport@example.test',
    );
    expect(href.startsWith('mailto:raport@example.test?')).toBe(true);
    const { subject, body } = decode(href);
    expect(subject).toBe('Raport: Învățătura lui Isus (ro)');
    expect(body).toContain(
      'Tip (alege unul: Traducere, Formatare, Text-sursă, Citat biblic, Altele):',
    );
    expect(body).toContain('Ediție: E-RO');
    expect(body).toContain('Paragraf: P-RO-7');
    expect(body).toContain('Paragraf-sursă: P-EN-7');
    expect(body).toContain(
      'Citare: — Geerhardus Vos, Titlu, I. Introducere (ediția română). — https://x.test/read/w/S1?p=P-RO-7',
    );
    expect(body).toContain('Comentariu:');
  });

  it('leaves out the lines it has nothing for (a report from the work page has no paragraph)', () => {
    const { body } = decode(
      reportMailHref({ title: 'Work', editionId: 'E', language: 'en' }, en, 'a@b.test'),
    );
    expect(body).toContain('Edition: E');
    expect(body).not.toContain('Paragraph:');
    expect(body).not.toContain('Source paragraph:');
    expect(body).toContain(
      'Type (choose one: Translation, Formatting, Source text, Bible quotation, Other):',
    );
  });
});
