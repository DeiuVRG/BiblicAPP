import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Pack } from '@biblioteca/shared';
import { describe, expect, it } from 'vitest';

import { defined } from '../lib/invariant';
import { checkOutput, loadCalques, loadGlossary, normaliseText } from './checks';
import type { CheckInput, CheckResult } from './checks';
import { AUGUSTINE, CREED, augustineSource, creedSource, finalOutput, jobsFor } from './fixtures';
import type { TranslationJob, TranslationOutput } from './schemas';
import { RO, goodOutput, jobOf } from './test-support';

/** The real materials of the repository: they must load and must not trouble a clean rendering. */
const MATERIALS = fileURLToPath(new URL('../../../../content/translation/', import.meta.url));
const glossaryEn = loadGlossary(path.join(MATERIALS, 'glossary-en.csv'));
const calquesEn = loadCalques(path.join(MATERIALS, 'calques-en.json'));
const glossaryRo = loadGlossary(path.join(MATERIALS, 'glossary-ro.csv'));
const calquesRo = loadCalques(path.join(MATERIALS, 'calques-ro.json'));

function materialsOf(job: TranslationJob): Pick<CheckInput, 'glossary' | 'calques'> {
  return job.targetLanguage === 'en'
    ? { glossary: glossaryEn, calques: calquesEn }
    : { glossary: glossaryRo, calques: calquesRo };
}

function check(
  job: TranslationJob,
  output: TranslationOutput,
  extra: Partial<CheckInput> = {},
): CheckResult {
  return checkOutput({
    job,
    output,
    file: 'final/test.json',
    ...materialsOf(job),
    tradition: 'undivided',
    fix: false,
    ...extra,
  });
}

const found = (result: CheckResult, code: string) =>
  result.report.findings.filter((f) => f.check === code);
const codes = (result: CheckResult) => [...new Set(result.report.findings.map((f) => f.check))];

/** A Latin source edition with one paragraph per given text (one section). */
function latinSource(...paragraphs: string[]): Pack {
  const base = augustineSource();
  return {
    ...base,
    paragraphs: paragraphs.map((text, i) => ({
      id: `par-${i + 1}`,
      sectionId: 'sec-1',
      ordinal: i,
      kind: 'p' as const,
      text,
    })),
  };
}

const augustineJob = (lang: 'en' | 'ro') => defined(jobsFor(augustineSource(), lang)[0], 'job');
const augustineOutput = (job: TranslationJob, text?: string) =>
  finalOutput(
    job,
    [text ?? AUGUSTINE[job.targetLanguage === 'en' ? 'en' : 'ro']],
    AUGUSTINE.heading[job.targetLanguage === 'en' ? 'en' : 'ro'],
  );

describe('a Latin source translated into English (Augustine, chapter I)', () => {
  const job = augustineJob('en');

  it('has the English materials in its job and no reference', () => {
    expect(job).toMatchObject({
      sourceLanguage: 'la',
      targetLanguage: 'en',
      materials: {
        rules: 'content/translation/rules-en.md',
        glossary: 'content/translation/glossary-en.csv',
        calques: 'content/translation/calques-en.json',
        profile: 'content/translation/profiles/augustine-de-spiritu-et-littera.md',
      },
    });
    expect(job.paragraphs[0]?.references).toEqual([]);
  });

  it('passes a clean rendering with nothing but the proposed glossary rows as INFO', () => {
    const result = check(job, augustineOutput(job));
    expect(result.report.ok).toBe(true);
    expect(result.report.strictOk).toBe(true);
    expect(result.report.findings.filter((f) => f.severity !== 'INFO')).toEqual([]);
    expect(codes(result)).toEqual(['FLAG_PROPOSED']);
    // the proposed rows that matched the Latin: sin, righteousness, baptism, mediator
    const rows = found(result, 'FLAG_PROPOSED').map(
      (f) => /glossary row (\S+)/.exec(f.message)?.[1],
    );
    expect(rows).toEqual(expect.arrayContaining(['peccatum', 'iustitia', 'baptismus', 'mediator']));
    expect(result.report.stats.lengthRatio).toBeGreaterThan(1.2);
    expect(result.report.stats.lengthRatio).toBeLessThan(1.3);
  });

  describe('the heading', () => {
    it('is headingEn: HEADING_MISSING without it, with a hint when headingRo is given instead', () => {
      const missing = augustineOutput(job);
      delete missing.headingEn;
      expect(found(check(job, missing), 'HEADING_MISSING')).toMatchObject([
        { severity: 'MAJOR', message: expect.stringContaining('must carry headingEn') },
      ]);
      const wrong = { ...missing, headingRo: 'Capitolul I' };
      const hint = found(check(job, wrong), 'HEADING_MISSING')[0]?.message ?? '';
      expect(hint).toContain('headingEn');
      expect(hint).toContain('headingRo is the field of the other target language');
      expect(found(check(job, augustineOutput(job)), 'HEADING_MISSING')).toEqual([]);
      expect(
        found(check(job, { ...augustineOutput(job), headingEn: '  ' }), 'HEADING_MISSING'),
      ).toHaveLength(1);
    });

    it('is not required in later parts of the section', () => {
      const later = { ...job, part: 1, parts: 2 };
      const output = augustineOutput(later);
      delete output.headingEn;
      expect(found(check(later, output), 'HEADING_MISSING')).toEqual([]);
    });

    it('is tidied with --fix under its own name, and its cedilla letters are left alone', () => {
      const output = { ...augustineOutput(job), headingEn: '  Chapter   I  ' };
      const fixed = check(job, output, { fix: true });
      expect(fixed.output.headingEn).toBe('Chapter I');
      expect(found(fixed, 'WHITESPACE')[0]?.message).toContain('headingEn');
      expect(fixed.changed).toBe(true);
    });
  });

  describe('typography', () => {
    it('leaves the letters s and t with a cedilla alone: no CEDILLA check in English', () => {
      const text = `${AUGUSTINE.en} See Ștefan (also written Ştefan) and Ţara.`;
      const result = check(job, augustineOutput(job, text), { fix: true });
      expect(found(result, 'CEDILLA')).toEqual([]);
      expect(result.output.paragraphs[0]?.text).toBe(text);
      expect(normaliseText(text, { cedilla: false }).text).toBe(text);
      expect(normaliseText(text).text).not.toBe(text); // the default is the Romanian fix
    });

    it('still fixes NFC and white space', () => {
      const dirty = `  ${AUGUSTINE.en.replace('Marcellinus', 'Marcellinus')}  ${'é'}  `;
      const result = check(job, augustineOutput(job, dirty), { fix: true });
      expect(found(result, 'NFC')).toHaveLength(1);
      expect(found(result, 'WHITESPACE')).toHaveLength(1);
      expect(result.output.paragraphs[0]?.text.endsWith('é')).toBe(true);
    });

    it('QUOTES_STRAIGHT: a straight double quotation mark', () => {
      const result = check(job, augustineOutput(job, `${AUGUSTINE.en} He said "yes".`));
      expect(found(result, 'QUOTES_STRAIGHT')).toMatchObject([
        { severity: 'MINOR', sourceId: 'par-1' },
      ]);
      expect(found(result, 'QUOTES_STRAIGHT')[0]?.message).toContain('English: “ and ”');
      expect(
        found(
          check(job, augustineOutput(job, `${AUGUSTINE.en} He said “yes”.`)),
          'QUOTES_STRAIGHT',
        ),
      ).toEqual([]);
    });

    it('QUOTES_CURLY_UNBALANCED: “ against ”', () => {
      const unbalanced = (extra: string) =>
        found(
          check(job, augustineOutput(job, `${AUGUSTINE.en} ${extra}`)),
          'QUOTES_CURLY_UNBALANCED',
        );
      expect(unbalanced('He said “yes.')).toHaveLength(1);
      expect(unbalanced('He said yes”.')).toHaveLength(1);
      expect(unbalanced('He said “yes” and “no”.')).toEqual([]);
      expect(unbalanced('He said “he told me ‘no’ twice”.')).toEqual([]);
      expect(unbalanced('He said “yes.')[0]?.message).toBe(
        '1 opening “ but 0 closing ” quotation marks',
      );
      expect(found(check(job, augustineOutput(job)), 'QUOTES_CURLY_UNBALANCED')).toEqual([]);
    });

    it('does not apply the Romanian checks to English', () => {
      const text = `${AUGUSTINE.en} He said „yes” and “no”.`;
      const result = check(job, augustineOutput(job, text));
      expect(found(result, 'QUOTES_ENGLISH')).toEqual([]);
      expect(found(result, 'QUOTES_UNBALANCED')).toEqual([]);
    });
  });

  describe('RESIDUE_LA', () => {
    const withLatin = (extra: string) =>
      check(job, augustineOutput(job, `${AUGUSTINE.en} ${extra}`));

    it('flags 4 or more Latin function words left in the English', () => {
      const result = withLatin('Quod enim sed autem cum ut dicit.');
      expect(found(result, 'RESIDUE_LA')).toMatchObject([{ severity: 'MAJOR', sourceId: 'par-1' }]);
      expect(found(result, 'RESIDUE_LA')[0]?.message).toMatch(
        /^\d+ Latin function word\(s\) left in \d+ tokens: /,
      );
    });

    it('flags a share of 3 % even with fewer than 4 hits', () => {
      const english = Array.from({ length: 97 }, () => 'word').join(' ');
      const flagged = check(job, augustineOutput(job, `${english} enim sed quod`));
      const not = check(job, augustineOutput(job, `${english} enim sed`));
      expect(found(flagged, 'RESIDUE_LA')).toHaveLength(1);
      expect(found(not, 'RESIDUE_LA')).toEqual([]);
    });

    it('never counts a word that is English too: in, ad, et, non', () => {
      const result = withLatin(
        'In vitro, ad hoc, Smith et al. and a non-literal, non sequitur in the end.',
      );
      expect(found(result, 'RESIDUE_LA')).toEqual([]);
    });

    it('does not count the Latin prefix of an English compound', () => {
      const english = Array.from({ length: 30 }, () => 'word').join(' ');
      const result = check(job, augustineOutput(job, `${english} sed-like enim-ish ut-ter`));
      expect(found(result, 'RESIDUE_LA')).toEqual([]);
    });

    it('does not take the English text of the fixture for Latin', () => {
      expect(found(check(job, augustineOutput(job)), 'RESIDUE_LA')).toEqual([]);
      expect(found(check(job, augustineOutput(job)), 'RESIDUE_EN')).toEqual([]);
    });
  });

  describe('LENGTH_RATIO (bands for the pair la to en)', () => {
    const sourceLength = AUGUSTINE.la.length;
    const filled = (ratio: number) =>
      'word '
        .repeat(Math.ceil((sourceLength * ratio) / 5) + 1)
        .slice(0, Math.round(sourceLength * ratio))
        .trim() + '.';
    const severityAt = (ratio: number) =>
      found(check(job, augustineOutput(job, filled(ratio))), 'LENGTH_RATIO').map((f) => f.severity);

    it('accepts 1.15 to 1.85, around what Latin gives', () => {
      for (const ratio of [1.15, 1.25, 1.3, 1.6, 1.85])
        expect(severityAt(ratio), String(ratio)).toEqual([]);
    });

    it('is MINOR from 1.0 to 1.1 and from 1.9 to 2.2', () => {
      expect(severityAt(1.05)).toEqual(['MINOR']);
      expect(severityAt(2.0)).toEqual(['MINOR']);
    });

    it('is MAJOR below 1.0 and above 2.2: shorter than the Latin, or padding', () => {
      expect(severityAt(0.8)).toEqual(['MAJOR']);
      expect(severityAt(2.4)).toEqual(['MAJOR']);
    });
  });

  describe('LENGTH_RATIO for the pair la to ro', () => {
    const ro = augustineJob('ro');
    const sourceLength = AUGUSTINE.la.length;
    const filled = (ratio: number) =>
      'cuvânt '
        .repeat(Math.ceil((sourceLength * ratio) / 7) + 1)
        .slice(0, Math.round(sourceLength * ratio))
        .trim() + '.';
    const severityAt = (ratio: number) =>
      found(check(ro, augustineOutput(ro, filled(ratio))), 'LENGTH_RATIO').map((f) => [
        f.severity,
        f.message.includes('shorter') ? 'shorter' : 'longer',
      ]);

    it('accepts 1.2 to 1.9, is MINOR near the edges and MAJOR beyond them', () => {
      for (const ratio of [1.2, 1.25, 1.5, 1.9])
        expect(severityAt(ratio), String(ratio)).toEqual([]);
      expect(severityAt(1.05)).toEqual([['MINOR', 'shorter']]);
      expect(severityAt(2.1)).toEqual([['MINOR', 'longer']]);
      expect(severityAt(0.9)).toEqual([['MAJOR', 'shorter']]);
      expect(severityAt(2.5)).toEqual([['MAJOR', 'longer']]);
    });
  });

  describe('glossary and calques of the English target', () => {
    it('GLOSSARY: a FIX row whose rendering is absent', () => {
      const text = AUGUSTINE.en.replace(/\bsin\b/g, 'wrongdoing');
      const result = check(job, augustineOutput(job, text));
      expect(found(result, 'GLOSSARY').map((f) => f.message)).toEqual([
        expect.stringContaining('glossary peccatum'),
      ]);
    });

    it('CALQUE: the Latinisms of the list are WARN (MINOR)', () => {
      const text = `${AUGUSTINE.en} It is so in the same manner as before, according to that which he said.`;
      const calques = found(check(job, augustineOutput(job, text)), 'CALQUE');
      expect(calques.map((f) => [f.severity, f.quoteTarget])).toEqual([
        ['MINOR', 'in the same manner as'],
        ['MINOR', 'according to that which'],
      ]);
    });

    it('CALQUE: archaisms and "Holy Ghost" are FORBID (MAJOR)', () => {
      const text = `${AUGUSTINE.en} Thou art, saith the Holy Ghost, verily.`;
      const found_ = found(check(job, augustineOutput(job, text)), 'CALQUE');
      expect(found_.filter((f) => f.severity === 'MAJOR').map((f) => f.quoteTarget)).toEqual(
        expect.arrayContaining(['Holy Ghost', 'Thou']),
      );
    });
  });
});

describe('a Latin source translated into Romanian (Augustine, chapter I)', () => {
  const job = augustineJob('ro');

  it('has the Romanian materials in its job', () => {
    expect(job.materials).toMatchObject({
      rules: 'content/translation/rules-ro.md',
      glossary: 'content/translation/glossary-ro.csv',
      calques: 'content/translation/calques-ro.json',
    });
  });

  it('passes a clean rendering', () => {
    const result = check(job, augustineOutput(job));
    expect(result.report.ok).toBe(true);
    expect(result.report.findings.filter((f) => f.severity !== 'INFO')).toEqual([]);
    expect(result.report.stats.lengthRatio).toBeGreaterThan(1.2);
    expect(result.report.stats.lengthRatio).toBeLessThan(1.3);
  });

  it('requires headingRo and fixes the cedilla letters, as for any Romanian translation', () => {
    const missing = augustineOutput(job);
    delete missing.headingRo;
    expect(found(check(job, missing), 'HEADING_MISSING')[0]?.message).toContain('headingRo');
    const text = AUGUSTINE.ro.replace('Marcelin', 'Marcelin ş ţ');
    const fixed = check(job, augustineOutput(job, text), { fix: true });
    expect(found(fixed, 'CEDILLA')).toHaveLength(1);
    expect(fixed.output.paragraphs[0]?.text).toContain('Marcelin ș ț');
  });

  it('flags Latin function words left in the Romanian, but not the Romanian words cum, est, ac', () => {
    const latin = check(job, augustineOutput(job, `${AUGUSTINE.ro} Quod enim sed autem ut dicit.`));
    expect(found(latin, 'RESIDUE_LA')).toHaveLength(1);
    const romanian = check(
      job,
      augustineOutput(job, `${AUGUSTINE.ro} Cum spune el, la est, cu ac, în non-sens, in vitro.`),
    );
    expect(found(romanian, 'RESIDUE_LA')).toEqual([]);
  });

  it('keeps the Romanian quotation checks', () => {
    const result = check(job, augustineOutput(job, `${AUGUSTINE.ro} El a spus "da" și “nu”.`));
    expect(found(result, 'QUOTES_STRAIGHT')).toHaveLength(1);
    expect(found(result, 'QUOTES_ENGLISH')).toHaveLength(1);
    expect(found(result, 'QUOTES_CURLY_UNBALANCED')).toEqual([]);
  });
});

describe('scripture references of a Latin source', () => {
  const SOURCE =
    'Sicut ait Apostolus, Rom. v. 12, et alibi, Ioh. 3, 5; ibid. 8, nec non Ps. 118, 2 et 1 Cor. xv, 22 sq.';
  const jobFor = (lang: 'en' | 'ro') => defined(jobsFor(latinSource(SOURCE), lang)[0], 'job');

  it('are converted to the notation of the target in the job, with the Vulgate note', () => {
    const en = jobFor('en').paragraphs[0]?.references ?? [];
    expect(en.map((r) => r.target)).toEqual([
      'Rom. 5:12',
      'John 3:5; v. 8',
      'Ps. 118:2',
      '1 Cor. 15:22 ff.',
    ]);
    expect(en[2]).toMatchObject({ canonical: ['Ps 118:2 vulgate'] });
    expect(en[2]?.note).toMatch(/Vulgate psalm numbering/);
    expect(en[0]?.note).toBeUndefined();
    const ro = jobFor('ro').paragraphs[0]?.references ?? [];
    expect(ro.map((r) => r.target)).toEqual([
      'Rom. 5:12',
      'In. 3:5; v. 8',
      'Ps. 118:2',
      '1 Cor. 15:22 ș.urm.',
    ]);
  });

  const english = (extra = '') =>
    `Thus the Apostle says, Rom. 5:12, and elsewhere, John 3:5; v. 8, as well as Ps. 118:2 and 1 Cor. 15:22 ff.${extra}`;

  it('REF_MISSING and REF_EXTRA compare the canonical items, ignoring the Vulgate marker', () => {
    const job = jobFor('en');
    const ok = check(job, finalOutput(job, [english()], 'Chapter I'));
    expect(found(ok, 'REF_MISSING')).toEqual([]);
    expect(found(ok, 'REF_EXTRA')).toEqual([]);
    expect(found(ok, 'REF_FORMAT')).toEqual([]);

    const renumbered = check(
      job,
      finalOutput(job, [english().replace('Ps. 118:2', 'Ps. 119:2')], 'Chapter I'),
    );
    expect(found(renumbered, 'REF_MISSING')[0]?.message).toContain('Ps 118:2');
    expect(found(renumbered, 'REF_EXTRA')[0]?.message).toContain('Ps 119:2');

    const dropped = check(job, finalOutput(job, [english().replace('; v. 8', '')], 'Chapter I'));
    expect(found(dropped, 'REF_MISSING')[0]?.message).toContain('John 3:8');
  });

  it('REF_FORMAT: roman numerals and Latin abbreviations in the English translation', () => {
    const job = jobFor('en');
    const result = check(
      job,
      finalOutput(
        job,
        [english().replace('Rom. 5:12', 'Rom. v. 12').replace('John 3:5', 'Ioh. 3, 5')],
        'Chapter I',
      ),
    );
    expect(found(result, 'REF_FORMAT')).toHaveLength(1);
    expect(found(result, 'REF_FORMAT')[0]?.message).toMatch(/^reference not in English notation: /);
    expect(found(result, 'REF_FORMAT')[0]?.message).toContain('Rom. v. 12');
    expect(found(result, 'REF_FORMAT')[0]?.message).toContain('Ioh. 3, 5');
    // and they are not the references of the source either
    expect(found(result, 'REF_MISSING').length).toBeGreaterThan(0);
  });

  it('REF_FORMAT: Latin notation in the Romanian translation, Romanian notation is valid', () => {
    const job = jobFor('ro');
    const romanian = `Astfel spune Apostolul, Rom. 5:12, și în altă parte, In. 3:5; v. 8, precum și Ps. 118:2 și 1 Cor. 15:22 ș.urm.`;
    const ok = check(job, finalOutput(job, [romanian], 'Capitolul I'));
    expect(found(ok, 'REF_MISSING')).toEqual([]);
    expect(found(ok, 'REF_FORMAT')).toEqual([]);
    const latin = check(
      job,
      finalOutput(job, [romanian.replace('In. 3:5', 'Ioh. 3, 5')], 'Capitolul I'),
    );
    expect(found(latin, 'REF_FORMAT')[0]?.message).toContain('Ioh. 3, 5');
    expect(found(latin, 'REF_FORMAT')[0]?.message).toMatch(/^reference not in Romanian notation: /);
  });

  it('NUMBER_MISSING does not count the numbers inside Latin references', () => {
    const job = jobFor('en');
    const result = check(job, finalOutput(job, [english()], 'Chapter I'));
    expect(found(result, 'NUMBER_MISSING')).toEqual([]);
  });

  it('NUMBER_MISSING counts the other Arabic numbers of a Latin paragraph', () => {
    const job = defined(
      jobsFor(latinSource('Anno 412 scripsit Augustinus haec, Rom. 5, 12.'), 'en')[0],
      'job',
    );
    const lost = check(
      job,
      finalOutput(job, ['In that year Augustine wrote this, Rom. 5:12.'], 'Chapter I'),
    );
    expect(found(lost, 'NUMBER_MISSING')[0]).toMatchObject({ quoteSource: '412' });
    const kept = check(
      job,
      finalOutput(job, ['In 412 Augustine wrote this, Rom. 5:12.'], 'Chapter I'),
    );
    expect(found(kept, 'NUMBER_MISSING')).toEqual([]);
  });
});

describe('a Greek source (the Creed of Constantinople)', () => {
  const jobs = (lang: 'en' | 'ro') => jobsFor(creedSource(), lang);
  const outputs = (lang: 'en' | 'ro') =>
    jobs(lang).map((job, i) => finalOutput(job, [CREED[lang][i] ?? ''], CREED.heading[lang][i]));

  it('has a job per article with the Greek heading, no reference and the English materials', () => {
    const [first] = jobs('en');
    expect(jobs('en')).toHaveLength(3);
    expect(first).toMatchObject({
      sourceLanguage: 'grc',
      targetLanguage: 'en',
      section: { heading: 'Ἄρθρον α΄', kind: 'section' },
      materials: {
        profile: 'content/translation/profiles/symbolum-nicaeno-constantinopolitanum.md',
      },
    });
    expect(jobs('en').every((j) => j.paragraphs.every((p) => p.references.length === 0))).toBe(
      true,
    );
  });

  it.each(['en', 'ro'] as const)('passes a clean translation of every article into %s', (lang) => {
    jobs(lang).forEach((job, i) => {
      const result = check(job, defined(outputs(lang)[i], 'output'));
      expect(result.report.ok, `${lang} article ${i + 1}`).toBe(true);
      expect(
        result.report.findings.filter((f) => f.severity !== 'INFO'),
        `${lang} ${i + 1}`,
      ).toEqual([]);
    });
  });

  it('does not ask for the Greek of the source in the translation (no GREEK_MISSING)', () => {
    const job = defined(jobs('en')[1], 'job');
    expect(found(check(job, defined(outputs('en')[1], 'output')), 'GREEK_MISSING')).toEqual([]);
  });

  describe('GREEK_COPY: the Greek that a translation keeps is an exact copy', () => {
    const job = defined(jobs('en')[1], 'job'); // the article of the Son
    const kept = (word: string) =>
      check(job, finalOutput(job, [`${CREED.en[1]} (the word is ${word}).`], CREED.heading.en[1]));

    it('accepts a term copied exactly from the source', () => {
      expect(found(kept('ὁμοούσιον'), 'GREEK_COPY')).toEqual([]);
      expect(found(kept('ὁμοούσιον τῷ Πατρί'), 'GREEK_COPY')).toEqual([]);
    });

    it('flags Greek with other accents or breathings than the source', () => {
      for (const altered of ['ὁμοουσιον', 'ὁμοούσιος', 'όμοούσιον', 'ομοούσιον']) {
        const result = kept(altered);
        expect(found(result, 'GREEK_COPY'), altered).toMatchObject([
          { severity: 'MAJOR', sourceId: 'par-2', quoteTarget: expect.any(String) },
        ]);
      }
    });

    it('flags Greek that the source does not have', () => {
      const result = kept('θεοτόκος');
      expect(found(result, 'GREEK_COPY')[0]?.message).toContain('θεοτόκος');
      expect(result.report.ok).toBe(true); // MAJOR, not CRITIC
      expect(result.report.strictOk).toBe(false);
    });

    it('does not accept a transliteration instead of the Greek, and does not make one', () => {
      const result = kept('homoousion');
      expect(found(result, 'GREEK_COPY')).toEqual([]);
      expect(result.output.paragraphs[0]?.text).toContain('(the word is homoousion).');
    });

    it('compares in NFC: a decomposed copy is the same word, and the oxia is the tonos', () => {
      const decomposed = 'ὁμοούσιον τῷ Πατρί'.normalize('NFD');
      expect(decomposed).not.toBe('ὁμοούσιον τῷ Πατρί');
      const result = kept(decomposed);
      expect(found(result, 'GREEK_COPY')).toEqual([]);
      expect(found(result, 'NFC')).toHaveLength(1);
      // U+1F71 (alpha with oxia) is the same letter as U+03AC (alpha with tonos) in NFC
      const oxia = String.fromCodePoint(0x1f71);
      const tonos = String.fromCodePoint(0x03ac);
      expect(`ἀναστ${oxia}ντα`.normalize('NFC')).toBe(`ἀναστ${tonos}ντα`);
      expect(CREED.grc[1]).toContain(`ἀναστ${tonos}ντα`);
      expect(found(kept(`ἀναστ${oxia}ντα`), 'GREEK_COPY')).toEqual([]);
    });

    it('treats the other articles the same way', () => {
      const third = defined(jobs('en')[2], 'job');
      const text = `${CREED.en[2]} (the word is συμπροσκυνούμενον).`;
      expect(
        found(check(third, finalOutput(third, [text], CREED.heading.en[2])), 'GREEK_COPY'),
      ).toEqual([]);
    });
  });

  it('SAME_AS_SOURCE: a Greek paragraph returned untranslated is CRITIC', () => {
    const job = defined(jobs('en')[0], 'job');
    const result = check(job, finalOutput(job, [CREED.grc[0] ?? ''], CREED.heading.en[0]));
    expect(found(result, 'SAME_AS_SOURCE')).toMatchObject([{ severity: 'CRITIC' }]);
    expect(result.report.ok).toBe(false);
  });

  describe('RESIDUE_GRC', () => {
    const job = defined(jobs('en')[0], 'job');
    const withGreek = (extra: string) =>
      check(job, finalOutput(job, [`${CREED.en[0]} ${extra}`], CREED.heading.en[0]));

    it('flags Greek function words left in the English, with or without accents and in any case', () => {
      for (const extra of [
        'καὶ τοῦ τῆς τὸν τὴν',
        'και του της τον την',
        'ΚΑΙ ΤΟΥ ΤΗΣ ΤΟΝ',
        'Καὶ ἐν εἰς διὰ',
      ]) {
        const result = withGreek(extra);
        expect(found(result, 'RESIDUE_GRC'), extra).toMatchObject([{ severity: 'MAJOR' }]);
        expect(found(result, 'RESIDUE_GRC')[0]?.message).toMatch(
          /Greek function word\(s\) left in/,
        );
      }
    });

    it('counts 3 % of the tokens as well as 4 hits, and a single word in a long text not at all', () => {
      const english = Array.from({ length: 150 }, () => 'word').join(' ');
      const one = check(job, finalOutput(job, [`${english} καὶ`], CREED.heading.en[0]));
      expect(found(one, 'RESIDUE_GRC')).toEqual([]);
      const share = check(
        job,
        finalOutput(job, [`${english.slice(0, 5 * 28)} καὶ τοῦ τῆς`], CREED.heading.en[0]),
      );
      expect(found(share, 'RESIDUE_GRC')).toHaveLength(1);
    });

    it('finds nothing in a clean English or Romanian translation', () => {
      expect(found(withGreek(''), 'RESIDUE_GRC')).toEqual([]);
      const ro = defined(jobs('ro')[0], 'job');
      expect(
        found(check(ro, finalOutput(ro, [CREED.ro[0] ?? ''], CREED.heading.ro[0])), 'RESIDUE_GRC'),
      ).toEqual([]);
      expect(codes(withGreek(''))).not.toContain('RESIDUE_EN');
      expect(codes(withGreek(''))).not.toContain('RESIDUE_LA');
    });
  });

  it('REF_EXTRA: a reference in the translation of a source that has none', () => {
    const job = defined(jobs('en')[0], 'job');
    const result = check(
      job,
      finalOutput(job, [`${CREED.en[0]} See Gen. 1:1.`], CREED.heading.en[0]),
    );
    expect(found(result, 'REF_EXTRA')).toMatchObject([
      { severity: 'MAJOR', quoteTarget: 'Gen. 1:1' },
    ]);
  });

  it('LENGTH_RATIO keeps the bands of the pipeline for Greek', () => {
    const job = defined(jobs('en')[1], 'job');
    const source = CREED.grc[1] ?? '';
    const short = 'word '.repeat(Math.ceil((source.length * 0.5) / 5)).trim();
    expect(
      found(check(job, finalOutput(job, [short], CREED.heading.en[1])), 'LENGTH_RATIO'),
    ).toMatchObject([{ severity: 'MAJOR' }]);
    for (let i = 0; i < 3; i += 1) {
      const article = defined(jobs('ro')[i], 'job');
      const result = check(article, defined(outputs('ro')[i], 'output'));
      expect(found(result, 'LENGTH_RATIO'), `ro ${i + 1}`).toEqual([]);
    }
  });
});

describe('the Romanian target keeps its codes, messages and severities', () => {
  it('has the same findings as before for an English source (messages of the Romanian checks)', () => {
    const job = jobOf(0);
    const output = goodOutput(job);
    const text = RO['src-a3'] ?? '';
    output.paragraphs = output.paragraphs.map((p) =>
      p.sourceId === 'src-a3' ? { ...p, text: `${text} the and of with "x" Matt. iv. 17` } : p,
    );
    const result = checkOutput({ job, output, file: 'f', glossary: [], calques: [], fix: false });
    expect(codes(result)).toEqual(
      expect.arrayContaining(['RESIDUE_EN', 'QUOTES_STRAIGHT', 'REF_FORMAT']),
    );
    expect(found(result, 'RESIDUE_EN')[0]?.message).toMatch(/English function word\(s\) left in/);
    expect(found(result, 'REF_FORMAT')[0]?.message).toMatch(
      /^reference not in Romanian notation: /,
    );
  });
});
