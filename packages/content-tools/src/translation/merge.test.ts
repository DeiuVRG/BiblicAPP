import { PackSchema, isUlid } from '@biblioteca/shared';
import type { Pack } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

import { mergeTranslation } from './merge';
import type { MergeInput, MergeResult } from './merge';
import type { LoadedFile } from './review';
import type { CheckReport, Flag, TranslationOutput } from './schemas';
import {
  EN,
  HEADING_RO,
  RO,
  checkReport,
  criticReport,
  goodOutput,
  makeJobs,
  makeSource,
  metaFor,
} from './test-support';

function finalsFor(source: Pack, edit: (output: TranslationOutput) => void = () => undefined) {
  return makeJobs(source).map((job): LoadedFile<TranslationOutput> => {
    const output = goodOutput(job);
    edit(output);
    return { file: `final/${job.jobId}.json`, data: output };
  });
}

function merge(overrides: Partial<MergeInput> = {}): MergeResult {
  const source = overrides.source ?? makeSource();
  return mergeTranslation({
    source,
    meta: metaFor(),
    previous: undefined,
    finals: finalsFor(source),
    critics: [],
    checks: [],
    partial: false,
    allowCritic: false,
    ...overrides,
  });
}

function packOf(result: MergeResult): Pack {
  if (!result.pack) throw new Error(`merge refused: ${result.problems.join('; ')}`);
  return result.pack;
}

const flag = (severity: Flag['severity'], quoteTarget?: string): Flag => ({
  code: 'CITAT_BIBLIC',
  severity,
  ...(quoteTarget === undefined ? {} : { quoteTarget }),
  note: 'scripture quoted by the author',
});

function withFlag(id: string, found: Flag) {
  return (output: TranslationOutput): void => {
    const paragraph = output.paragraphs.find((p) => p.sourceId === id);
    if (paragraph) paragraph.flags = [found];
  };
}

describe('mergeTranslation: a complete translation', () => {
  const result = merge();
  const pack = packOf(result);

  it('builds a valid translated edition aligned to the source', () => {
    expect(PackSchema.safeParse(pack).success).toBe(true);
    expect(pack.work).toEqual(makeSource().work);
    expect(pack.edition).toEqual({
      id: result.editionId,
      language: 'ro',
      kind: 'translation',
      licence: { status: 'unknown', note: 'Traducere nouă, în curs de revizie.' },
      provenance: {
        source: 'Machine translation of edition-en, human review pending.',
        extractedBy: 'translation pipeline',
        notes: 'Draft.',
      },
      sourceEditionId: 'edition-en',
    });
    expect(result.editionIdSource).toBe('generated');
    expect(isUlid(result.editionId)).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.coverage).toEqual({ paragraphs: [5, 5], sections: [2, 2] });
  });

  it('mirrors the source sections and paragraphs with new ids and sourceIds', () => {
    expect(pack.sections.map((s) => [s.ordinal, s.kind, s.heading, s.sourceId])).toEqual([
      [0, 'chapter', HEADING_RO['sec-a'], 'sec-a'],
      [1, 'chapter', HEADING_RO['sec-b'], 'sec-b'],
    ]);
    expect(pack.paragraphs.map((p) => [p.ordinal, p.kind, p.sourceId, p.text])).toEqual(
      Object.keys(EN).map((id, index) => [
        index < 3 ? index : index - 3,
        'p',
        id,
        RO[id],
      ]),
    );
    const ids = [...pack.sections.map((s) => s.id), ...pack.paragraphs.map((p) => p.id)];
    expect(ids.every(isUlid)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(pack.paragraphs.map((p) => p.sectionId)).toEqual([
      pack.sections[0]?.id,
      pack.sections[0]?.id,
      pack.sections[0]?.id,
      pack.sections[1]?.id,
      pack.sections[1]?.id,
    ]);
  });

  it('writes the text in NFC', () => {
    const decomposed = (RO['src-b2'] ?? '').normalize('NFD');
    const nfd = merge({
      finals: finalsFor(makeSource(), (output) => {
        const p = output.paragraphs.find((x) => x.sourceId === 'src-b2');
        if (p) p.text = decomposed;
      }),
    });
    expect(packOf(nfd).paragraphs.find((p) => p.sourceId === 'src-b2')?.text).toBe(RO['src-b2']);
  });

  it('has no timestamps anywhere', () => {
    expect(JSON.stringify(pack)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(result.review).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('mergeTranslation: ids', () => {
  it('reuses the ids of the existing edition by sourceId across runs', () => {
    const first = merge();
    const previous = packOf(first);
    const second = merge({
      previous,
      meta: metaFor({ id: first.editionId }),
      finals: finalsFor(makeSource(), (output) => {
        const p = output.paragraphs[0];
        if (p) p.text = `${p.text} (revizuit)`;
        output.headingRo = output.headingRo ? `${output.headingRo} (revizuit)` : output.headingRo;
      }),
    });
    const next = packOf(second);
    expect(next.edition.id).toBe(previous.edition.id);
    expect(next.sections.map((s) => s.id)).toEqual(previous.sections.map((s) => s.id));
    expect(next.paragraphs.map((p) => p.id)).toEqual(previous.paragraphs.map((p) => p.id));
    expect(next.paragraphs[0]?.text).toContain('(revizuit)');
    expect(second.editionIdSource).toBe('meta');
  });

  it('is byte-identical when nothing changed', () => {
    const first = merge();
    const again = merge({ previous: packOf(first), meta: metaFor({ id: first.editionId }) });
    expect(JSON.stringify(again.pack)).toBe(JSON.stringify(first.pack));
    expect(again.review).toBe(first.review);
  });

  it('takes the edition id of an existing edition when the metadata has none', () => {
    const first = merge();
    const again = merge({ previous: packOf(first) });
    expect(again.editionId).toBe(first.editionId);
    expect(again.editionIdSource).toBe('previous');
  });

  it('gives new units new ids and never reuses the id of a unit that disappeared', () => {
    const first = packOf(merge());
    const removedParagraph = first.paragraphs.find((p) => p.sourceId === 'src-a2');

    // src-a2 disappears from the source (and from the outputs); a new paragraph appears
    const source = makeSource();
    source.paragraphs = source.paragraphs.filter((p) => p.id !== 'src-a2');
    source.paragraphs.push({ id: 'src-b3', sectionId: 'sec-b', ordinal: 2, kind: 'p', text: EN['src-b2'] ?? '' });
    const finals = finalsFor(source, (output) => {
      output.paragraphs = output.paragraphs.filter((p) => p.sourceId !== 'src-a2');
      const added = output.paragraphs.find((p) => p.sourceId === 'src-b3');
      if (added) added.text = 'Un paragraf nou, tradus separat.';
    });
    const next = packOf(merge({ source, previous: first, finals }));

    expect(next.paragraphs.some((p) => p.id === removedParagraph?.id)).toBe(false);
    const kept = next.paragraphs.find((p) => p.sourceId === 'src-a1');
    expect(kept?.id).toBe(first.paragraphs.find((p) => p.sourceId === 'src-a1')?.id);
    const created = next.paragraphs.find((p) => p.sourceId === 'src-b3');
    expect(created && isUlid(created.id)).toBe(true);
    expect(first.paragraphs.some((p) => p.id === created?.id)).toBe(false);
  });
});

describe('mergeTranslation: coverage', () => {
  it('refuses a missing paragraph and lists it', () => {
    const source = makeSource();
    const finals = finalsFor(source, (output) => {
      output.paragraphs = output.paragraphs.filter((p) => p.sourceId !== 'src-a2');
    });
    const result = merge({ source, finals });
    expect(result.pack).toBeUndefined();
    expect(result.review).toBeUndefined();
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/section 1 "I\. The Kingdom Announced": 1 of 3 paragraphs.*2 \(src-a2\)/);
    expect(result.coverage).toEqual({ paragraphs: [2, 5], sections: [1, 2] });
  });

  it('refuses a missing job as a whole', () => {
    const finals = finalsFor(makeSource()).slice(0, 1);
    const result = merge({ finals });
    expect(result.pack).toBeUndefined();
    expect(result.problems[0]).toMatch(/section 2.*2 of 2 paragraphs/);
  });

  it('with partial, emits only the sections that are fully covered and says so in the notes', () => {
    const finals = finalsFor(makeSource()).slice(0, 1);
    const result = merge({ finals, partial: true });
    const pack = packOf(result);
    expect(pack.sections.map((s) => s.sourceId)).toEqual(['sec-a']);
    expect(pack.paragraphs.map((p) => p.sourceId)).toEqual(['src-a1', 'src-a2', 'src-a3']);
    expect(pack.edition.provenance.notes).toBe('Draft. Partial translation: 1 of 2 sections.');
    expect(result.coverage).toEqual({ paragraphs: [3, 5], sections: [1, 2] });
    expect(result.review).toContain('3/5 paragrafe, 1/2 secțiuni');
    expect(PackSchema.safeParse(pack).success).toBe(true);
  });

  it('with partial, leaves a half-covered section out and refuses when nothing is covered', () => {
    const source = makeSource();
    const half = finalsFor(source, (output) => {
      output.paragraphs = output.paragraphs.filter((p) => p.sourceId !== 'src-b2');
    });
    expect(packOf(merge({ source, finals: half, partial: true })).sections).toHaveLength(1);
    const none = merge({ finals: [], partial: true });
    expect(none.pack).toBeUndefined();
    expect(none.problems).toEqual(['no section is fully covered, nothing to merge']);
  });

  it('does not add the partial sentence when everything is covered', () => {
    expect(packOf(merge({ partial: true })).edition.provenance.notes).toBe('Draft.');
  });

  it('refuses unknown and repeated sourceIds even with partial', () => {
    const unknown = finalsFor(makeSource());
    unknown[0]?.data.paragraphs.push({ sourceId: 'src-nope', text: 'x', flags: [] });
    const result = merge({ finals: unknown, partial: true });
    expect(result.pack).toBeUndefined();
    expect(result.problems.join('\n')).toContain('src-nope is not a paragraph of the source edition');

    const repeated = finalsFor(makeSource());
    repeated.push({ file: 'final/copy.json', data: structuredClone(repeated[0]?.data as TranslationOutput) });
    const dup = merge({ finals: repeated });
    expect(dup.pack).toBeUndefined();
    expect(dup.problems.join('\n')).toMatch(
      /final\/fixture-work-ro-01-00\.json: source paragraph src-a1 is already rendered in final\/copy\.json/,
    );
  });
});

describe('mergeTranslation: headings', () => {
  it('uses headingRo of the part-0 output', () => {
    expect(packOf(merge()).sections[0]?.heading).toBe(HEADING_RO['sec-a']);
  });

  it('falls back to the source heading and warns', () => {
    const finals = finalsFor(makeSource(), (output) => {
      if (output.paragraphs.some((p) => p.sourceId === 'src-a1')) delete output.headingRo;
      if (output.paragraphs.some((p) => p.sourceId === 'src-b1')) output.headingRo = '  ';
    });
    const result = merge({ finals });
    expect(packOf(result).sections.map((s) => s.heading)).toEqual([
      'I. The Kingdom Announced',
      'II. The Church',
    ]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('section 1');
    expect(result.warnings[0]).toContain('using the source heading');
  });

  it('takes headingRo from the output that holds the first paragraph, not from a later part', () => {
    const source = makeSource();
    const first = finalsFor(source)[0];
    if (!first) throw new Error('fixture');
    const partOne = structuredClone(first.data);
    partOne.jobId = 'fixture-work-ro-01-01';
    partOne.headingRo = 'Titlu greșit din partea 1';
    partOne.paragraphs = [];
    const result = merge({ finals: [...finalsFor(source), { file: 'final/fixture-work-ro-01-01.json', data: partOne }] });
    expect(packOf(result).sections[0]?.heading).toBe(HEADING_RO['sec-a']);
  });
});

describe('mergeTranslation: CRITIC findings', () => {
  const critical = (source: Pack) => finalsFor(source, (output) => withFlag('src-a2', flag('CRITIC', 'pocăință'))(output));

  it('refuses an output with a CRITIC flag, but still produces the review sheet', () => {
    const result = merge({ finals: critical(makeSource()) });
    expect(result.pack).toBeUndefined();
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/open CRITIC finding \(revised\) section 1, src-a2: \[CITAT_BIBLIC\]/);
    expect(result.review).toContain('| CRITIC | 1 | 2 (src-a2) |');
    expect(result.counts.CRITIC).toBe(1);
  });

  it('merges with allowCritic and lists the finding in the sheet', () => {
    const refused = merge({ finals: critical(makeSource()) });
    const allowed = merge({ finals: critical(makeSource()), allowCritic: true });
    expect(allowed.pack).toBeDefined();
    expect(allowed.problems).toEqual([]);
    expect(allowed.review).toBe(refused.review);
  });

  it('refuses a CRITIC finding of the latest check report of a final output', () => {
    const [job] = makeJobs(makeSource());
    if (!job) throw new Error('fixture');
    const report = checkReport(job, [
      { check: 'SAME_AS_SOURCE', severity: 'CRITIC', sourceId: 'src-a3', message: 'untranslated' },
    ]);
    const result = merge({ checks: [{ file: `checks/${job.jobId}.json`, data: report }] });
    expect(result.pack).toBeUndefined();
    expect(result.problems[0]).toContain('open CRITIC finding (check)');
    expect(merge({ checks: [{ file: `checks/${job.jobId}.json`, data: report }], allowCritic: true }).pack).toBeDefined();
  });

  it('ignores a check report about a draft, and the FLAG_CRITIC echo of a flag', () => {
    const [job] = makeJobs(makeSource());
    if (!job) throw new Error('fixture');
    const critic = { check: 'SAME_AS_SOURCE', severity: 'CRITIC' as const, sourceId: 'src-a3', message: 'x' };
    const draft = checkReport(job, [critic], `drafts/${job.jobId}.json`);
    expect(merge({ checks: [{ file: `checks/${job.jobId}.json`, data: draft }] }).pack).toBeDefined();
    const echo = checkReport(job, [{ ...critic, check: 'FLAG_CRITIC' }]);
    expect(merge({ checks: [{ file: `checks/${job.jobId}.json`, data: echo }] }).pack).toBeDefined();
  });

  it('does not let a CRITIC finding of a section that is left out block a partial merge', () => {
    const source = makeSource();
    const jobs = makeJobs(source);
    const finals = finalsFor(source).slice(0, 1);
    const secondJob = jobs[1];
    if (!secondJob) throw new Error('fixture');
    const report: CheckReport = checkReport(secondJob, [
      { check: 'HEADING_MISSING', severity: 'CRITIC', message: 'job level' },
      { check: 'EMPTY_TEXT', severity: 'CRITIC', sourceId: 'src-b1', message: 'empty' },
    ]);
    const result = merge({ finals, partial: true, checks: [{ file: `checks/${secondJob.jobId}.json`, data: report }] });
    expect(result.pack).toBeDefined();
    expect(result.counts.CRITIC).toBe(0);
  });

  it('does not let a critic report block the merge, but lists it', () => {
    const [job] = makeJobs(makeSource());
    if (!job) throw new Error('fixture');
    const report = criticReport(job, [
      {
        sourceId: 'src-a1',
        severity: 'CRITIC',
        category: 'negatie',
        quoteSource: 'was at hand',
        quoteTarget: 'este aproape',
        problem: 'the negation is lost',
        proposal: 'keep it',
      },
    ]);
    const result = merge({ critics: [{ file: `critic/${job.jobId}.json`, data: report }] });
    expect(result.pack).toBeDefined();
    expect(result.counts.CRITIC).toBe(1);
    expect(result.review).toContain('| CRITIC | 1 | 1 (src-a1) | was at hand | este aproape | [negatie] the negation is lost | keep it | critic |');
  });
});

describe('review sheet', () => {
  const sourceFlag = (output: TranslationOutput, id: string, flags: Flag[]) => {
    const paragraph = output.paragraphs.find((p) => p.sourceId === id);
    if (paragraph) paragraph.flags = flags;
  };

  /** Table rows as [severity, section, paragraph, source, target, problem, proposal, origin]. */
  const rowsOf = (review: string | undefined): string[][] =>
    (review ?? '')
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Severitate') && !line.startsWith('| ---'))
      .map((line) => line.slice(2, -2).split(' | '));

  it('has the header, the columns and no rows when nothing is open', () => {
    const { review } = merge();
    expect(review).toBe(
      [
        '# Fișă de revizie: Lucrare de probă',
        '',
        '- Lucrare: Fixture work (fixture-work)',
        '- Limbi: en -> ro',
        '- Acoperire: 5/5 paragrafe, 2/2 secțiuni',
        '- Modele: draft: -; critic: -; revised: claude-sonnet-5-5',
        '- Constatări: CRITIC 0, MAJOR 0, SURSA_POSIBIL_ERONATA 0, MINOR 0, INFO 0',
        '',
        '| Severitate | Secțiune | Paragraf (sourceId) | Sursă | Traducere | Problemă | Propunere | Origine |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        '',
        'Nu există constatări deschise.',
        '',
      ].join('\n'),
    );
  });

  it('orders by severity, then section, then paragraph, and lists models per pass', () => {
    const source = makeSource();
    const jobs = makeJobs(source);
    const finals = finalsFor(source, (output) => {
      sourceFlag(output, 'src-b2', [flag('MINOR', 'minor-b2'), flag('CRITIC', 'critic-b2')]);
      sourceFlag(output, 'src-a3', [flag('MAJOR', 'major-a3')]);
      sourceFlag(output, 'src-a1', [flag('INFO', 'info-a1'), flag('MAJOR', 'major-a1')]);
    });
    const [jobA, jobB] = jobs;
    if (!jobA || !jobB) throw new Error('fixture');
    const critic = criticReport(jobA, [
      {
        sourceId: 'src-b1',
        severity: 'SURSA_POSIBIL_ERONATA',
        category: 'alta',
        quoteSource: 'q1',
        quoteTarget: 'q2',
        problem: 'the source may be wrong',
        proposal: 'check the printed book',
      },
      {
        sourceId: 'src-a2',
        severity: 'MINOR',
        category: 'termen',
        quoteSource: 'repentance',
        quoteTarget: 'pocăință',
        problem: 'term',
        proposal: 'convertire',
      },
    ]);
    critic.model = 'claude-opus-5-5';
    const checks = [
      {
        file: `checks/${jobB.jobId}.json`,
        data: checkReport(jobB, [
          { check: 'LENGTH_RATIO', severity: 'MAJOR', sourceId: 'src-b1', message: 'too short' },
          { check: 'CEDILLA', severity: 'MINOR', sourceId: 'src-b2', message: 'fixed', autofixed: true },
          { check: 'FLAG_CRITIC', severity: 'CRITIC', sourceId: 'src-b2', message: 'echo' },
          { check: 'FLAG_PROPOSED', severity: 'INFO', sourceId: 'src-a1', message: 'proposed row' },
        ]),
      },
    ];
    const result = merge({
      finals,
      critics: [{ file: `critic/${jobA.jobId}.json`, data: critic }],
      checks,
      allowCritic: true,
    });
    const rows = rowsOf(result.review);
    expect(rows.map((r) => [r[0], r[1], r[2], r[7]])).toEqual([
      ['CRITIC', '2', '2 (src-b2)', 'revised'],
      ['MAJOR', '1', '1 (src-a1)', 'revised'],
      ['MAJOR', '1', '3 (src-a3)', 'revised'],
      ['MAJOR', '2', '1 (src-b1)', 'check'],
      ['SURSA_POSIBIL_ERONATA', '2', '1 (src-b1)', 'critic'],
      ['MINOR', '1', '2 (src-a2)', 'critic'],
      ['MINOR', '2', '2 (src-b2)', 'revised'],
      ['INFO', '1', '1 (src-a1)', 'revised'],
      ['INFO', '1', '1 (src-a1)', 'check'],
    ]);
    expect(result.review).toContain(
      '- Modele: draft: -; critic: claude-opus-5-5; revised: claude-sonnet-5-5',
    );
    expect(result.review).toContain('- Constatări: CRITIC 1, MAJOR 3, SURSA_POSIBIL_ERONATA 1, MINOR 2, INFO 2');
    expect(result.counts).toEqual({ CRITIC: 1, MAJOR: 3, SURSA_POSIBIL_ERONATA: 1, MINOR: 2, INFO: 2 });
  });

  it('lists a critic finding once when the final output has a flag on the same passage', () => {
    const source = makeSource();
    const [job] = makeJobs(source);
    if (!job) throw new Error('fixture');
    const finals = finalsFor(source, (output) => sourceFlag(output, 'src-a2', [flag('MAJOR', 'pocăință')]));
    const critic = criticReport(job, [
      {
        sourceId: 'src-a2',
        severity: 'MAJOR',
        category: 'termen',
        quoteSource: 'repentance',
        quoteTarget: 'pocăință',
        problem: 'same passage as the flag',
        proposal: 'x',
      },
      {
        sourceId: 'src-a2',
        severity: 'MINOR',
        category: 'termen',
        quoteSource: 'mind',
        quoteTarget: 'minții',
        problem: 'another passage',
        proposal: 'y',
      },
    ]);
    const rows = rowsOf(merge({ finals, critics: [{ file: `critic/${job.jobId}.json`, data: critic }] }).review);
    expect(rows.map((r) => [r[0], r[7]])).toEqual([
      ['MAJOR', 'revised'],
      ['MINOR', 'critic'],
    ]);
  });

  it('escapes pipes and line breaks in table cells', () => {
    const source = makeSource();
    const finals = finalsFor(source, (output) =>
      sourceFlag(output, 'src-a1', [
        { code: 'ALTA', severity: 'MINOR', quoteSource: 'a | b', quoteTarget: 'c\nd', note: 'x | y' },
      ]),
    );
    const review = merge({ finals }).review ?? '';
    expect(review).toContain('| MINOR | 1 | 1 (src-a1) | a \\| b | c d | [ALTA] x \\| y |  | revised |');
  });

  it('is deterministic', () => {
    const source = makeSource();
    const edit = (output: TranslationOutput) => sourceFlag(output, 'src-a1', [flag('MINOR', 'q')]);
    const a = merge({ finals: finalsFor(source, edit) });
    const b = merge({ finals: finalsFor(source, edit).reverse() });
    expect(b.review).toBe(a.review);
  });
});
