import type { Edition, Pack } from '@biblioteca/shared';

import {
  CORRECTIONS_PER_PAGE,
  correctionsPage,
  openFlags,
  resolveProvenance,
} from '@/content/provenance';
import { bundledPack } from '@/test-support/packs';

const edition = (
  patch: Omit<Partial<Edition>, 'provenance'> & {
    provenance?: Partial<Edition['provenance']>;
  } = {},
): Edition => ({
  id: 'e1',
  language: 'en',
  kind: 'source',
  licence: { status: 'public-domain', note: '' },
  ...patch,
  provenance: { source: '', extractedBy: '', notes: '', ...patch.provenance },
});

describe('resolveProvenance: what the record says', () => {
  it('takes the kind and the fields the pack gives', () => {
    const resolved = resolveProvenance(
      edition({
        language: 'ro',
        kind: 'translation',
        provenance: {
          kind: 'ai',
          sourceLanguage: 'en',
          model: 'claude-sonnet-5-5',
          generatedAt: '2026-11-05',
          passes: ['draft', 'critic', 'revision'],
          checks: [
            { code: 'parity', status: 'passed' },
            { code: 'glossary', status: 'flagged', flags: 4 },
          ],
          review: { state: 'needs-review' },
        },
      }),
    );
    expect(resolved).toMatchObject({
      lead: 'ai',
      machine: true,
      transcriptionNote: false,
      sourceLanguage: 'en',
      model: 'claude-sonnet-5-5',
      generatedAt: '2026-11-05',
      reviewed: false,
      reviewedAt: null,
      reviewerRole: null,
    });
    expect(resolved.passes).toEqual(['draft', 'critic', 'revision']);
    expect(openFlags(resolved.checks)).toBe(4);
  });

  it('says "also a transcription" as a second note on a native or a source edition, never twice', () => {
    expect(
      resolveProvenance(edition({ provenance: { kind: 'native', transcription: true } })),
    ).toMatchObject({ lead: 'native', transcriptionNote: true });
    expect(
      resolveProvenance(
        edition({ language: 'la', provenance: { kind: 'source', transcription: true } }),
      ),
    ).toMatchObject({ lead: 'source', transcriptionNote: true });
    // When the lead is the transcription itself there is no second note.
    expect(
      resolveProvenance(edition({ provenance: { source: 'OCR of a scan', notes: '' } })),
    ).toMatchObject({ lead: 'transcription', transcriptionNote: false });
  });

  it('reads the review: the reviewer role and the date only once it is reviewed', () => {
    const reviewed = resolveProvenance(
      edition({
        kind: 'translation',
        provenance: {
          kind: 'human',
          review: { state: 'reviewed', at: '2027-01-10', roleNote: ' theologian and philologist ' },
        },
      }),
    );
    expect(reviewed).toMatchObject({
      reviewed: true,
      reviewedAt: '2027-01-10',
      reviewerRole: 'theologian and philologist',
    });
    const pending = resolveProvenance(
      edition({ provenance: { review: { state: 'needs-review', roleNote: 'not yet' } } }),
    );
    expect(pending).toMatchObject({ reviewed: false, reviewedAt: null, reviewerRole: null });
  });

  it('lists corrections newest first', () => {
    const resolved = resolveProvenance(
      edition({
        provenance: {
          corrections: [
            { at: '2026-12-01', summary: 'a' },
            { at: '2027-02-01', summary: 'c' },
            { at: '2027-01-01T08:00:00Z', summary: 'b' },
          ],
        },
      }),
    );
    expect(resolved.corrections.map((c) => c.summary)).toEqual(['c', 'b', 'a']);
  });
});

describe('resolveProvenance: derived when the fields are absent (ai, human, transcription, source, native, unknown)', () => {
  const translation = (notes: string, extra = '') =>
    resolveProvenance(
      edition({ language: 'ro', kind: 'translation', provenance: { source: extra, notes } }),
    );

  it('calls a translation by a model machine-made', () => {
    expect(translation('Draft translation by claude-sonnet-5-5').lead).toBe('ai');
    expect(translation('Produced with artificial intelligence').lead).toBe('ai');
    expect(translation('Traducere făcută cu inteligență artificială').lead).toBe('ai');
  });

  it('calls a translation with a translator human-made, and one that says nothing unknown', () => {
    expect(translation('Translated by Anne Example, 1910').lead).toBe('human');
    expect(translation('').lead).toBe('unknown');
    // The machine wins over the person when both are named (the precedence of the spec).
    expect(translation('Translated by hand, checked with claude').lead).toBe('ai');
  });

  it('calls a source in the language of a reading language "native", and in another language "source"', () => {
    expect(resolveProvenance(edition({ language: 'en' })).lead).toBe('native');
    expect(resolveProvenance(edition({ language: 'ro' })).lead).toBe('native');
    expect(resolveProvenance(edition({ language: 'la' })).lead).toBe('source');
    expect(resolveProvenance(edition({ language: 'grc' })).lead).toBe('source');
  });

  it('calls a source whose record speaks of a scan a transcription', () => {
    expect(
      resolveProvenance(
        edition({ language: 'la', provenance: { extractedBy: 'pdftotext on the scan' } }),
      ).lead,
    ).toBe('transcription');
    expect(
      resolveProvenance(edition({ provenance: { notes: 'Text recognised by OCR.' } })).lead,
    ).toBe('transcription');
  });

  it('reads the two bundled Vos editions as the pack states them', () => {
    const en = bundledPack('vos-1903-kingdom-en').pack as Pack;
    const ro = bundledPack('vos-1903-kingdom-ro').pack as Pack;
    expect(resolveProvenance(en.edition)).toMatchObject({
      lead: 'native',
      transcriptionNote: true,
      machine: false,
      reviewed: false,
    });
    const roResolved = resolveProvenance(ro.edition);
    expect(roResolved).toMatchObject({
      lead: 'ai',
      machine: true,
      sourceLanguage: 'en',
      model: 'claude-sonnet-5-5',
      reviewed: false,
    });
    expect(roResolved.passes).toEqual(['draft', 'critic', 'revision']);
    expect(roResolved.checks.map((check) => check.code)).toEqual(
      expect.arrayContaining(['parity', 'references', 'glossary', 'calques']),
    );
  });
});

describe('correctionsPage: five to a page, newest first', () => {
  const six = Array.from({ length: 6 }, (_, index) => ({
    at: `2027-0${index + 1}-01`,
    summary: `change ${index + 1}`,
  })).reverse();

  it('has five on the first page, one on the second, and keeps the page in range', () => {
    expect(CORRECTIONS_PER_PAGE).toBe(5);
    expect(correctionsPage(six, 0)).toMatchObject({ pages: 2, page: 0 });
    expect(correctionsPage(six, 0).items).toHaveLength(5);
    expect(correctionsPage(six, 1).items.map((c) => c.summary)).toEqual(['change 1']);
    expect(correctionsPage(six, 9).page).toBe(1);
    expect(correctionsPage(six, -3).page).toBe(0);
    expect(correctionsPage([], 0)).toEqual({ items: [], pages: 1, page: 0 });
  });
});
