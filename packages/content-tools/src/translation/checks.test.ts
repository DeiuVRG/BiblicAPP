import { describe, expect, it } from 'vitest';

import { checkOutput, normaliseText, parseGlossary } from './checks';
import type { CheckInput, CheckResult } from './checks';
import { parseCalques } from './glossary';
import type { Flag, TranslationOutput } from './schemas';
import { EN, RO, goodOutput, jobOf } from './test-support';

const HEADER = 'term_id,source_pattern,target_pattern,tradition,scope,force,status,note';
const glossary = (...rows: string[]) => parseGlossary([HEADER, ...rows].join('\n'), 'test');

const job = jobOf(0); // section A: src-a1, src-a2, src-a3

function textOf(output: TranslationOutput, id: string): string {
  const paragraph = output.paragraphs.find((p) => p.sourceId === id);
  if (!paragraph) throw new Error(`no paragraph ${id}`);
  return paragraph.text;
}

function setText(output: TranslationOutput, id: string, text: string): void {
  const paragraph = output.paragraphs.find((p) => p.sourceId === id);
  if (!paragraph) throw new Error(`no paragraph ${id}`);
  paragraph.text = text;
}

function check(
  mutate: (output: TranslationOutput) => void = () => undefined,
  extra: Partial<CheckInput> = {},
): CheckResult {
  const output = goodOutput(job);
  mutate(output);
  return checkOutput({
    job,
    output,
    file: 'final/test.json',
    glossary: [],
    calques: [],
    fix: false,
    ...extra,
  });
}

const found = (result: CheckResult, code: string) =>
  result.report.findings.filter((f) => f.check === code);

describe('a clean rendering', () => {
  it('has no findings and a consistent report', () => {
    const result = check();
    expect(result.report.findings).toEqual([]);
    expect(result.report).toMatchObject({
      jobId: job.jobId,
      file: 'final/test.json',
      ok: true,
      strictOk: true,
    });
    expect(result.changed).toBe(false);
    const { stats } = result.report;
    expect(stats.paragraphs).toBe(3);
    expect(stats.sourceWords).toBe(job.wordCount);
    expect(stats.targetWords).toBeGreaterThan(40);
    expect(stats.lengthRatio).toBeGreaterThan(0.85);
    expect(stats.lengthRatio).toBeLessThan(1.45);
    expect(stats.lengthRatio).toBe(Math.round(stats.lengthRatio * 1000) / 1000);
  });

  it('does not modify its input', () => {
    const output = goodOutput(job);
    const copy = structuredClone(output);
    checkOutput({ job, output, file: 'f', glossary: [], calques: [], fix: true });
    expect(output).toEqual(copy);
  });
});

describe('parity (CRITIC)', () => {
  it('PARITY_MISSING: a job paragraph without output', () => {
    const result = check((o) => {
      o.paragraphs.splice(1, 1);
    });
    expect(found(result, 'PARITY_MISSING')).toMatchObject([
      { severity: 'CRITIC', sourceId: 'src-a2' },
    ]);
    expect(result.report.ok).toBe(false);
    expect(result.report.strictOk).toBe(false);
    expect(found(check(), 'PARITY_MISSING')).toEqual([]);
  });

  it('PARITY_EXTRA: an output sourceId that is not in the job', () => {
    const result = check((o) => {
      o.paragraphs.push({ sourceId: 'src-zzz', text: 'Un paragraf în plus.', flags: [] });
    });
    expect(found(result, 'PARITY_EXTRA')).toMatchObject([{ severity: 'CRITIC', sourceId: 'src-zzz' }]);
    expect(found(check(), 'PARITY_EXTRA')).toEqual([]);
  });

  it('PARITY_DUPLICATE: a sourceId twice, reported once and checked once', () => {
    const result = check((o) => {
      o.paragraphs.push({ sourceId: 'src-a1', text: textOf(o, 'src-a1'), flags: [] });
    });
    expect(found(result, 'PARITY_DUPLICATE')).toMatchObject([
      { severity: 'CRITIC', sourceId: 'src-a1' },
    ]);
    expect(result.report.findings).toHaveLength(1);
    expect(found(check(), 'PARITY_DUPLICATE')).toEqual([]);
  });
});

describe('EMPTY_TEXT (CRITIC)', () => {
  it('flags a text that is only white space and does not "fix" it to nothing', () => {
    const result = check((o) => setText(o, 'src-a2', ' \n '), { fix: true });
    expect(found(result, 'EMPTY_TEXT')).toMatchObject([{ severity: 'CRITIC', sourceId: 'src-a2' }]);
    expect(found(result, 'WHITESPACE')).toEqual([]);
    expect(textOf(result.output, 'src-a2')).toBe(' \n ');
    expect(found(check(), 'EMPTY_TEXT')).toEqual([]);
  });
});

describe('SAME_AS_SOURCE (CRITIC)', () => {
  it('flags a target equal to the source', () => {
    const result = check((o) => setText(o, 'src-a3', EN['src-a3'] ?? ''));
    expect(found(result, 'SAME_AS_SOURCE')).toMatchObject([
      { severity: 'CRITIC', sourceId: 'src-a3', quoteSource: (EN['src-a3'] ?? '').slice(0, 80) },
    ]);
  });

  it('flags a target that is 90 % similar to the source', () => {
    const almost = (EN['src-a3'] ?? '').replace('doubted', 'doubtful');
    const result = check((o) => setText(o, 'src-a3', almost));
    expect(found(result, 'SAME_AS_SOURCE')).toHaveLength(1);
  });

  it('accepts a real translation and a source without letters', () => {
    expect(found(check(), 'SAME_AS_SOURCE')).toEqual([]);
    const ornament = { ...job, paragraphs: [{ ...job.paragraphs[0]!, text: '* * *', references: [] }] };
    const output = { ...goodOutput(job), paragraphs: [{ sourceId: 'src-a1', text: '* * *', flags: [] }] };
    const result = checkOutput({ job: ornament, output, file: 'f', glossary: [], calques: [], fix: false });
    expect(found(result, 'SAME_AS_SOURCE')).toEqual([]);
  });
});

describe('GREEK_MISSING (CRITIC)', () => {
  it('flags Greek of the source that the target dropped', () => {
    const result = check((o) =>
      setText(o, 'src-a2', (RO['src-a2'] ?? '').replace('μετανοέω', 'metanoeo')),
    );
    expect(found(result, 'GREEK_MISSING')).toMatchObject([
      { severity: 'CRITIC', sourceId: 'src-a2', quoteSource: 'μετανοέω' },
    ]);
  });

  it('compares in NFC, so a decomposed target still contains the word', () => {
    const decomposed = (RO['src-a2'] ?? '').replace('μετανοέω', 'μετανοέω'.normalize('NFD'));
    expect(decomposed).not.toBe(RO['src-a2']);
    expect(found(check((o) => setText(o, 'src-a2', decomposed)), 'GREEK_MISSING')).toEqual([]);
    expect(found(check(), 'GREEK_MISSING')).toEqual([]);
  });
});

describe('FLAG_CRITIC (CRITIC)', () => {
  const flag = (severity: Flag['severity']): Flag => ({
    code: 'AMBIGUITATE',
    severity,
    quoteSource: 'the kingdom',
    quoteTarget: 'Împărăția',
    note: 'cannot be rendered faithfully',
  });

  it('reports a CRITIC flag of the output so that merge can refuse it', () => {
    const result = check((o) => {
      const first = o.paragraphs[0];
      if (first) first.flags = [flag('CRITIC')];
    });
    expect(found(result, 'FLAG_CRITIC')).toMatchObject([
      { severity: 'CRITIC', sourceId: 'src-a1', quoteSource: 'the kingdom', quoteTarget: 'Împărăția' },
    ]);
    expect(found(result, 'FLAG_CRITIC')[0]?.message).toContain('AMBIGUITATE');
  });

  it('ignores flags of lower severity', () => {
    const result = check((o) => {
      const first = o.paragraphs[0];
      if (first) first.flags = [flag('MAJOR'), flag('INFO')];
    });
    expect(found(result, 'FLAG_CRITIC')).toEqual([]);
  });
});

describe('HEADING_MISSING (MAJOR)', () => {
  it('requires headingRo in part 0', () => {
    const missing = check((o) => {
      delete o.headingRo;
    });
    expect(found(missing, 'HEADING_MISSING')).toMatchObject([{ severity: 'MAJOR' }]);
    expect(missing.report.ok).toBe(true);
    expect(missing.report.strictOk).toBe(false);
    expect(found(check((o) => (o.headingRo = '   ')), 'HEADING_MISSING')).toHaveLength(1);
    expect(found(check(), 'HEADING_MISSING')).toEqual([]);
  });

  it('does not require it in later parts', () => {
    const later = { ...job, part: 1, parts: 2 };
    const output = goodOutput(later);
    delete output.headingRo;
    const result = checkOutput({ job: later, output, file: 'f', glossary: [], calques: [], fix: false });
    expect(found(result, 'HEADING_MISSING')).toEqual([]);
  });
});

describe('RESIDUE_EN (MAJOR)', () => {
  const romanian = (n: number) => Array.from({ length: n }, () => 'cuvânt').join(' ');

  it('flags 4 or more English function words', () => {
    const text = 'La început the kingdom and the church of God au venit, iar pocăința este limpede.';
    const result = check((o) => setText(o, 'src-a3', text));
    expect(found(result, 'RESIDUE_EN')).toMatchObject([{ severity: 'MAJOR', sourceId: 'src-a3' }]);
    expect(found(result, 'RESIDUE_EN')[0]?.message).toContain('the x2');
  });

  it('flags a share of 3 % even with fewer than 4 hits', () => {
    const three = `${romanian(97)} the and of`; // 3 of 100 tokens
    const two = `${romanian(98)} the and`; // 2 of 100 tokens
    expect(found(check((o) => setText(o, 'src-a3', three)), 'RESIDUE_EN')).toHaveLength(1);
    expect(found(check((o) => setText(o, 'src-a3', two)), 'RESIDUE_EN')).toEqual([]);
  });

  it('never counts words with Romanian diacritics or parts of longer words', () => {
    const text = 'Într-o parte ofițerul și îndrumătorul din „ceață” sunt aici, nu cu mulți.';
    expect(found(check((o) => setText(o, 'src-a3', text)), 'RESIDUE_EN')).toEqual([]);
    expect(found(check(), 'RESIDUE_EN')).toEqual([]);
  });
});

describe('scripture references (MAJOR)', () => {
  it('REF_MISSING: a reference of the source is not in the target', () => {
    const result = check((o) => setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('; Mc. 1:15', '')));
    expect(found(result, 'REF_MISSING')).toMatchObject([
      { severity: 'MAJOR', sourceId: 'src-a1', quoteSource: 'Matt. iv. 17; Mk. i. 15' },
    ]);
    expect(found(result, 'REF_MISSING')[0]?.message).toContain('Mark 1:15');
    expect(found(result, 'REF_EXTRA')).toEqual([]);
  });

  it('REF_EXTRA: the target has a reference the source does not have', () => {
    const result = check((o) => setText(o, 'src-a3', `${RO['src-a3'] ?? ''} Vezi In. 3:16.`));
    expect(found(result, 'REF_EXTRA')).toMatchObject([
      { severity: 'MAJOR', sourceId: 'src-a3', quoteTarget: 'In. 3:16' },
    ]);
  });

  it('accepts the same references in another order, and repeated ones as a multiset', () => {
    const swapped = (RO['src-a1'] ?? '').replace('Mat. 4:17; Mc. 1:15', 'Mc. 1:15; Mat. 4:17');
    expect(found(check((o) => setText(o, 'src-a1', swapped)), 'REF_MISSING')).toEqual([]);
    const twice = `${RO['src-a1'] ?? ''} Mc. 1:15.`;
    expect(found(check((o) => setText(o, 'src-a1', twice)), 'REF_EXTRA')).toHaveLength(1);
  });
});

describe('LENGTH_RATIO', () => {
  const sourceLength = (EN['src-a3'] ?? '').length;
  const filled = (ratio: number) =>
    'cuvânt '.repeat(Math.ceil((sourceLength * ratio) / 7) + 1).slice(0, Math.round(sourceLength * ratio)).trim() + '.';
  const severityAt = (ratio: number) =>
    found(check((o) => setText(o, 'src-a3', filled(ratio))), 'LENGTH_RATIO').map((f) => f.severity);

  it('is MAJOR below 0.75 and above 1.6', () => {
    expect(severityAt(0.6)).toEqual(['MAJOR']);
    expect(severityAt(1.8)).toEqual(['MAJOR']);
  });

  it('is MINOR from 0.75 to 0.85 and from 1.45 to 1.6', () => {
    expect(severityAt(0.8)).toEqual(['MINOR']);
    expect(severityAt(1.5)).toEqual(['MINOR']);
  });

  it('accepts ratios from 0.85 to 1.45', () => {
    for (const ratio of [0.9, 1, 1.2, 1.4]) expect(severityAt(ratio), String(ratio)).toEqual([]);
  });
});

describe('CALQUE and glossary FORBID/WARN', () => {
  const calques = parseCalques(
    JSON.stringify([
      { id: 'centru', pattern: 'în CENTRUL învățăturii', level: 'FORBID', preferred: 'în miezul' },
      { id: 'ani', pattern: 'trei ani', level: 'WARN', preferred: '' },
    ]),
    'calques',
  );

  it('flags a FORBID calque as MAJOR and a WARN calque as MINOR, ignoring case', () => {
    const result = check(undefined, { calques });
    expect(found(result, 'CALQUE').map((f) => [f.severity, f.quoteTarget])).toEqual([
      ['MAJOR', 'în centrul învățăturii'],
      ['MINOR', 'trei ani'],
    ]);
    expect(found(result, 'CALQUE')[0]?.message).toContain('prefer: în miezul');
    expect(found(check(), 'CALQUE')).toEqual([]);
  });

  it('applies a glossary FORBID row when the source matches, and everywhere without a source', () => {
    const rules = glossary(
      'regat,\\bkingdom\\b,\\bregat,all,all,FORBID,APROBAT,never "Regat"',
      'pocainta,,\\bpocăință\\b,all,all,FORBID,APROBAT,',
      'minte,,\\bminții\\b,all,all,WARN,APROBAT,',
      'altceva,\\bchurch\\b,\\bîmpărăți,all,all,FORBID,APROBAT,',
    );
    const withRegat = check((o) => setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('Împărăția', 'Regatul')), { glossary: rules });
    expect(found(withRegat, 'CALQUE').map((f) => [f.severity, f.sourceId, f.quoteTarget])).toEqual([
      ['MAJOR', 'src-a1', 'Regat'],
      ['MAJOR', 'src-a2', 'pocăință'],
      ['MINOR', 'src-a2', 'minții'],
    ]);
    // the "church" row needs "church" in the source of the paragraph: src-a3 has none
    expect(found(withRegat, 'CALQUE').some((f) => f.message.includes('altceva'))).toBe(false);
  });
});

describe('REF_FORMAT (MINOR)', () => {
  it('flags English abbreviations and roman numerals in the target', () => {
    const result = check((o) =>
      setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('Mat. 4:17; Mc. 1:15', 'Matt. iv. 17; Mk. i. 15')),
    );
    expect(found(result, 'REF_FORMAT')).toMatchObject([
      { severity: 'MINOR', sourceId: 'src-a1', quoteTarget: 'Matt. iv. 17; Mk. i. 15' },
    ]);
    // the references are not in Romanian notation, so they also count as missing
    expect(found(result, 'REF_MISSING')).toHaveLength(1);
    expect(found(check(), 'REF_FORMAT')).toEqual([]);
  });

  it('flags vs. and English abbreviations with Arabic numerals', () => {
    const text = `${RO['src-a3'] ?? ''} Cf. Jno. 3:16, vs. 5.`;
    expect(found(check((o) => setText(o, 'src-a3', text)), 'REF_FORMAT')[0]?.message).toContain('Jno. 3:16');
  });
});

describe('NUMBER_MISSING (MINOR)', () => {
  it('flags a number of the source that the target lost', () => {
    const result = check((o) => setText(o, 'src-a3', (RO['src-a3'] ?? '').replace('1903', 'acum')));
    expect(found(result, 'NUMBER_MISSING')).toMatchObject([
      { severity: 'MINOR', sourceId: 'src-a3', quoteSource: '1903' },
    ]);
    expect(found(check(), 'NUMBER_MISSING')).toEqual([]);
  });

  it('ignores the numbers inside references and accepts other number formats', () => {
    // src-a1 and src-a2 have digits only inside references that the target writes differently
    expect(found(check(), 'NUMBER_MISSING')).toEqual([]);
    // thousands separators differ between English (1,903) and Romanian (1.903)
    const english = { ...job, paragraphs: job.paragraphs.map((p) => ({ ...p, text: p.text.replace('1903', '1,903') })) };
    const output = goodOutput(job);
    setText(output, 'src-a3', (RO['src-a3'] ?? '').replace('1903', '1.903'));
    const result = checkOutput({ job: english, output, file: 'f', glossary: [], calques: [], fix: false });
    expect(found(result, 'NUMBER_MISSING')).toEqual([]);
  });
});

describe('GLOSSARY (MINOR)', () => {
  const fix = glossary('kingdom,\\bkingdom\\b,\\bîmpărăți,all,all,FIX,APROBAT,Împărăția');

  it('flags a FIX row whose rendering is absent', () => {
    const result = check((o) => setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('Împărăția', 'Regatul')), { glossary: fix });
    expect(found(result, 'GLOSSARY')).toMatchObject([
      { severity: 'MINOR', sourceId: 'src-a1', quoteSource: 'kingdom' },
    ]);
    expect(found(check(undefined, { glossary: fix }), 'GLOSSARY')).toEqual([]);
  });

  it('honours scope and tradition', () => {
    const bad = (o: TranslationOutput) => setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('Împărăția', 'Regatul'));
    const rows = [
      glossary('k,\\bkingdom\\b,\\bîmpărăți,orthodox,all,FIX,APROBAT,')[0],
      glossary('k,\\bkingdom\\b,\\bîmpărăți,all,other-work,FIX,APROBAT,')[0],
    ].flatMap((r) => (r ? [r] : []));
    expect(found(check(bad, { glossary: rows, tradition: 'protestant' }), 'GLOSSARY')).toEqual([]);
    expect(found(check(bad, { glossary: rows, tradition: 'orthodox' }), 'GLOSSARY')).toHaveLength(1);
    expect(found(check(bad, { glossary: rows }), 'GLOSSARY')).toEqual([]);
    const undivided = glossary('k,\\bkingdom\\b,\\bîmpărăți,undivided,fixture-work,FIX,APROBAT,');
    expect(found(check(bad, { glossary: undivided }), 'GLOSSARY')).toHaveLength(1);
  });

  it('does not check PREFER rows', () => {
    const prefer = glossary('kingdom,\\bkingdom\\b,\\bîmpărăți,all,all,PREFER,APROBAT,');
    const bad = check((o) => setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('Împărăția', 'Regatul')), { glossary: prefer });
    expect(found(bad, 'GLOSSARY')).toEqual([]);
  });
});

describe('quotation marks (MINOR)', () => {
  const with_ = (extra: string) => check((o) => setText(o, 'src-a3', `${RO['src-a3'] ?? ''} ${extra}`));

  it('QUOTES_STRAIGHT: a straight quotation mark', () => {
    expect(found(with_('El a spus "da".'), 'QUOTES_STRAIGHT')).toMatchObject([
      { severity: 'MINOR', sourceId: 'src-a3' },
    ]);
    expect(found(with_('El a spus „da”.'), 'QUOTES_STRAIGHT')).toEqual([]);
  });

  it('QUOTES_ENGLISH: the English opening mark', () => {
    expect(found(with_('El a spus “da”.'), 'QUOTES_ENGLISH')).toHaveLength(1);
    expect(found(with_('El a spus „da”.'), 'QUOTES_ENGLISH')).toEqual([]);
  });

  it('QUOTES_UNBALANCED: counts „ and ” and does not count “', () => {
    expect(found(with_('El a spus „da.'), 'QUOTES_UNBALANCED')).toHaveLength(1);
    expect(found(with_('El a spus „da” și „nu”.'), 'QUOTES_UNBALANCED')).toEqual([]);
    const mixed = with_('El a spus „da“.');
    expect(found(mixed, 'QUOTES_UNBALANCED')).toHaveLength(1);
    expect(found(mixed, 'QUOTES_ENGLISH')).toHaveLength(1);
    expect(found(check(), 'QUOTES_UNBALANCED')).toEqual([]);
  });
});

describe('FLAG_PROPOSED (INFO)', () => {
  it('lists a PROPUS glossary row that matched, and not an APROBAT one', () => {
    const rows = glossary(
      'kingdom,\\bkingdom\\b,\\bîmpărăți,all,all,FIX,PROPUS,proposed rendering',
      'church,\\bchurch\\b,\\bbiseric,all,all,FIX,APROBAT,',
      'absent,\\bangels\\b,\\bîngeri,all,all,FIX,PROPUS,',
    );
    const result = check(undefined, { glossary: rows });
    expect(found(result, 'FLAG_PROPOSED')).toMatchObject([
      { severity: 'INFO', sourceId: 'src-a1', quoteSource: 'kingdom', quoteTarget: 'Împărăți' },
    ]);
    expect(found(result, 'FLAG_PROPOSED')[0]?.message).toContain('kingdom (FIX)');
    expect(result.report.ok).toBe(true);
    expect(result.report.strictOk).toBe(true);
  });

  it('matches a PROPUS row without a source pattern by its target', () => {
    const rows = glossary('pocainta,,\\bpocăință\\b,all,all,WARN,PROPUS,');
    expect(found(check(undefined, { glossary: rows }), 'FLAG_PROPOSED')).toHaveLength(1);
  });
});

describe('auto-fixes: CEDILLA, NFC, WHITESPACE', () => {
  const cedilla = 'ş ţ Ş Ţ';
  const decomposed = 'ă'.normalize('NFD');
  const dirty = `  ${RO['src-a3'] ?? ''}\n  Cuvântul ${cedilla} şi ${decomposed}  \n`;

  it('normaliseText applies all three fixes', () => {
    const n = normaliseText(dirty);
    expect(n).toMatchObject({ nfc: true, cedilla: 5, whitespace: true });
    expect(n.text).toBe(`${RO['src-a3'] ?? ''} Cuvântul ș ț Ș Ț și ă`);
    expect(normaliseText(RO['src-a3'] ?? '')).toMatchObject({ nfc: false, cedilla: 0, whitespace: false });
  });

  it('reports the defects without fixing them when fix is off', () => {
    const result = check((o) => setText(o, 'src-a3', dirty));
    for (const code of ['CEDILLA', 'NFC', 'WHITESPACE']) {
      expect(found(result, code), code).toMatchObject([
        { severity: 'MINOR', sourceId: 'src-a3', autofixed: false },
      ]);
    }
    expect(textOf(result.output, 'src-a3')).toBe(dirty);
    expect(result.changed).toBe(false);
    expect(result.report.ok).toBe(true);
  });

  it('fixes them when fix is on, keeping the findings with autofixed: true', () => {
    const result = check((o) => setText(o, 'src-a3', dirty), { fix: true });
    for (const code of ['CEDILLA', 'NFC', 'WHITESPACE']) {
      expect(found(result, code)[0]?.autofixed, code).toBe(true);
    }
    expect(textOf(result.output, 'src-a3')).toBe(normaliseText(dirty).text);
    expect(result.changed).toBe(true);
    // a second run over the fixed output finds nothing to fix
    const again = checkOutput({ job, output: result.output, file: 'f', glossary: [], calques: [], fix: true });
    expect(again.changed).toBe(false);
    expect(found(again, 'CEDILLA')).toEqual([]);
    expect(found(again, 'NFC')).toEqual([]);
    expect(found(again, 'WHITESPACE')).toEqual([]);
  });

  it('fixes headingRo too, and does not fix other checks', () => {
    const result = check(
      (o) => {
        o.headingRo = ' Împărăţia   vestită ';
      },
      { fix: true },
    );
    expect(result.output.headingRo).toBe('Împărăția vestită');
    expect(found(result, 'CEDILLA')[0]?.message).toContain('headingRo');
    expect(result.changed).toBe(true);
  });

  it('runs the other checks on the normalised text', () => {
    // with cedilla and NFD text, the Greek and reference checks still see the right text
    const result = check((o) => setText(o, 'src-a2', `${(RO['src-a2'] ?? '').normalize('NFD')}  `));
    expect(found(result, 'GREEK_MISSING')).toEqual([]);
    expect(found(result, 'REF_MISSING')).toEqual([]);
    expect(found(result, 'NFC')).toHaveLength(1);
  });
});

describe('severity bookkeeping', () => {
  it('orders findings by severity and derives ok / strictOk', () => {
    const result = check((o) => {
      setText(o, 'src-a3', `${RO['src-a3'] ?? ''} "x"`); // MINOR
      setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('; Mc. 1:15', '')); // MAJOR
      o.paragraphs.splice(1, 1); // CRITIC
    });
    const severities = result.report.findings.map((f) => f.severity);
    expect(severities).toEqual([...severities].sort((a, b) => 'CRITIC MAJOR MINOR INFO'.indexOf(a) - 'CRITIC MAJOR MINOR INFO'.indexOf(b)));
    expect(result.report.ok).toBe(false);

    const minorOnly = check((o) => setText(o, 'src-a3', `${RO['src-a3'] ?? ''} "x"`));
    expect(minorOnly.report.ok).toBe(true);
    expect(minorOnly.report.strictOk).toBe(true);
    const majorOnly = check((o) => setText(o, 'src-a1', (RO['src-a1'] ?? '').replace('; Mc. 1:15', '')));
    expect(majorOnly.report.ok).toBe(true);
    expect(majorOnly.report.strictOk).toBe(false);
  });

  it('is deterministic', () => {
    const a = check((o) => setText(o, 'src-a3', `${RO['src-a3'] ?? ''} "x" the and of with`));
    const b = check((o) => setText(o, 'src-a3', `${RO['src-a3'] ?? ''} "x" the and of with`));
    expect(JSON.stringify(a.report)).toBe(JSON.stringify(b.report));
  });
});
