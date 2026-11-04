import { describe, expect, it } from 'vitest';

import { IngestConfigSchema, parseIngestConfig } from './config';
import {
  detectRunningHeads,
  edgeNumbers,
  isFootFurniture,
  parsePageNumber,
  stripFurniture,
  stripPageNumber,
} from './furniture';
import type { FurnitureOptions, PageInput } from './furniture';
import { isAllCapsHeading, parseChapterMarker, romanToInt } from './headings';
import { buildVocabulary, decideHyphen, joinLines } from './hyphenation';
import type { HyphenOptions } from './hyphenation';
import { assignIds, lcsPairs } from './ids';
import { endsSentence, segmentParagraphs, startsParagraph } from './paragraphs';
import type { SegmentOptions } from './paragraphs';
import { applyPageFixes, cleanText, ingest } from './pipeline';
import { typographicQuotes } from './quotes';
import { splitPages } from './text';

const noHyphenOptions: HyphenOptions = { keep: new Set(), join: new Set() };

describe('dehyphenation', () => {
  const vocabulary = buildVocabulary([
    'the kingdom of God is a God-centered',
    'view. The kingdom is the kingdom.',
    'a God-centered purpose and a king',
    'and the kingdom-idea is great',
  ]);

  it('joins soft hyphens ("king-" + "dom")', () => {
    const choice = decideHyphen('king', 'dom', vocabulary, noHyphenOptions);
    expect(choice.decision).toBe('join');
  });

  it('keeps a compound that the text itself writes with a hyphen', () => {
    const choice = decideHyphen('God', 'centered', vocabulary, noHyphenOptions);
    expect(choice.decision).toBe('keep');
  });

  it('honours the config lists', () => {
    const keep: HyphenOptions = { keep: new Set(['high-priestly']), join: new Set() };
    expect(decideHyphen('high', 'priestly', vocabulary, keep).decision).toBe('keep');
    const join: HyphenOptions = { keep: new Set(), join: new Set(['godcentered']) };
    expect(decideHyphen('God', 'centered', vocabulary, join).decision).toBe('join');
  });

  it('does not count line-end fragments as words', () => {
    const v = buildVocabulary(['the king-', 'dom of God']);
    expect(v.words.get('king')).toBeUndefined();
    expect(v.words.get('dom')).toBeUndefined();
  });

  it('joins lines of a paragraph and resolves hyphens', () => {
    const { text, choices } = joinLines(
      [
        'The king-',
        'dom of God is a God-',
        'centered view and the kingdom-',
        'idea 14-',
        '16 and Old-',
        'Testament.',
      ],
      vocabulary,
      noHyphenOptions,
    );
    expect(text).toBe(
      'The kingdom of God is a God-centered view and the kingdom-idea 14-16 and Old-Testament.',
    );
    expect(choices.map((c) => c.decision)).toEqual(['join', 'keep', 'keep']);
  });

  it('joins ordinary line breaks with one space', () => {
    expect(joinLines(['one', '  two  ', 'three'], vocabulary, noHyphenOptions).text).toBe(
      'one two three',
    );
  });
});

describe('paragraph joining', () => {
  const layout: SegmentOptions = {
    mode: 'layout',
    indentMin: 2,
    indentMax: 9,
    shortEndChars: 5,
    shortLineRatio: 0.8,
    abbreviations: ['vs'],
  };
  const lines = (texts: string[]) => texts.map((text) => ({ text, page: 1 }));

  it('starts a paragraph at an indented line after a sentence end', () => {
    const result = segmentParagraphs(
      lines([
        'first paragraph runs over the whole line.',
        '   Second paragraph begins here and goes',
        'on for a second line of text in the page.',
      ]),
      layout,
    );
    expect(result.paragraphs).toHaveLength(2);
    expect(result.paragraphs[1]).toHaveLength(2);
  });

  it('starts a paragraph after a short sentence-ending line without indentation', () => {
    const result = segmentParagraphs(
      lines([
        'a line that is as long as the others are.',
        'a line that is as long as the others are.',
        'a line that is as long as the others are.',
        'short end.',
        'Next paragraph without any indentation.',
      ]),
      layout,
    );
    expect(result.paragraphs.map((p) => p.length)).toEqual([4, 1]);
  });

  it('does not break at an abbreviation or when the previous line is unterminated', () => {
    const result = segmentParagraphs(
      lines([
        'with the kingdom, cf. Mk. x. 17, with vs.',
        '23. While thus recognizing that it is',
        '   Indented but the previous line is open',
        'a line that is as long as the others are.',
      ]),
      layout,
    );
    expect(result.paragraphs).toHaveLength(1);
    expect(result.suspects).toHaveLength(1);
  });

  it('length mode (plain text) uses the line length', () => {
    const plain: SegmentOptions = { ...layout, mode: 'length' };
    const result = segmentParagraphs(
      lines([
        'the first line is a full and long line of',
        'the second line is also a full long line.',
        'end.',
        'The next paragraph starts with a capital',
        'letter and continues here for a while on.',
      ]),
      plain,
    );
    expect(result.mode).toBe('length');
    expect(result.paragraphs.map((p) => p.length)).toEqual([3, 2]);
  });

  it('helpers', () => {
    expect(endsSentence('He said so."')).toBe(true);
    expect(endsSentence('and then')).toBe(false);
    expect(endsSentence('with vs.', new Set(['vs']))).toBe(false);
    expect(startsParagraph('=- The closing')).toBe(true);
    expect(startsParagraph('-; The relation')).toBe(true);
    expect(startsParagraph('23. While')).toBe(false);
    expect(startsParagraph('and so')).toBe(false);
  });
});

describe('running heads and page furniture', () => {
  const titles = [
    'The Kingdom and the Church',
    'Tlte Kingdom and lite Clturclt',
    'TIle Kingdom aud tIle Clturclt',
    'The Kingdom and the Church',
    'Tile Kingdom and the Cilltrcll',
  ];
  const pages: PageInput[] = Array.from({ length: 10 }, (_, i) => {
    const page = i + 9;
    const printed = page - 7;
    const head =
      printed % 2 === 0
        ? `${printed}   ${titles[i % titles.length]}`
        : `      Introductory      ${printed}`;
    return { page, lines: [head, 'first body line of the page', 'second body line of the page'] };
  });
  const options: FurnitureOptions = {
    zoneLines: 2,
    minRepeats: 3,
    similarity: 0.65,
    extraPatterns: [],
    footZoneLines: 2,
    footMaxChars: 6,
  };

  it('reads damaged page numbers', () => {
    expect(parsePageNumber('S2')).toBe(52);
    expect(parsePageNumber('4 I')).toBe(41);
    expect(parsePageNumber('12.5')).toBe(125);
    expect(parsePageNumber('word')).toBeNull();
    expect(edgeNumbers('Present and Future Kingdom 39')).toContain(39);
    expect(stripPageNumber('I 10   Tlte Kingdom')).toBe('Tlte Kingdom');
  });

  it('detects head families by repetition with OCR tolerance', () => {
    const model = detectRunningHeads(pages, options);
    expect(model.families.length).toBeGreaterThanOrEqual(2);
    expect(model.pageOffset).toBe(7);
  });

  it('removes heads, including garbled ones that carry the predicted page number', () => {
    const model = detectRunningHeads(pages, options);
    const garbled: PageInput = {
      page: 20,
      lines: ['13   Zzq xxk wvu', 'body line one', 'body line two'],
    };
    const { lines, removed } = stripFurniture(garbled, model, options);
    expect(lines).toEqual(['body line one', 'body line two']);
    expect(removed).toHaveLength(1);
  });

  it('keeps body text and removes foot marks', () => {
    const model = detectRunningHeads(pages, options);
    const { lines, removed } = stripFurniture(
      { page: 30, lines: ['23   The Kingdom and the Church', 'real text', 'more text', '', 'B'] },
      model,
      options,
    );
    expect(lines).toEqual(['real text', 'more text', '']);
    expect(removed.map((r) => r.where).sort()).toEqual(['foot', 'head']);
  });

  it('does not remove the head zone of opening pages', () => {
    const model = detectRunningHeads(pages, options);
    const { lines } = stripFurniture(
      { page: 8, lines: ['Introductory', 'body'] },
      model,
      options,
      true,
    );
    expect(lines).toEqual(['Introductory', 'body']);
  });

  it('classifies foot furniture', () => {
    expect(isFootFurniture('  A       I ', 6)).toBe(true);
    expect(isFootFurniture("'.~ J", 6)).toBe(true);
    expect(isFootFurniture('12.5', 6)).toBe(true);
    expect(isFootFurniture('tion.', 6)).toBe(false);
    expect(isFootFurniture('kingdom.', 6)).toBe(false);
  });
});

describe('heading detection', () => {
  const pattern = /^\s*CHAPTER\s+([IVXLCDM]+)\.?\s*$/;

  it('reads chapter markers', () => {
    expect(parseChapterMarker('       CHAPTER IV', pattern)).toEqual({ number: 'IV', value: 4 });
    expect(parseChapterMarker('CHAPTER XIX.', pattern)).toEqual({ number: 'XIX', value: 19 });
    expect(parseChapterMarker('CHAPTER ONE', pattern)).toBeNull();
    expect(parseChapterMarker('Chapter text', pattern)).toBeNull();
  });

  it('converts roman numerals', () => {
    expect(romanToInt('XLII')).toBe(42);
    expect(romanToInt('MCMXC')).toBe(1990);
    expect(romanToInt('ABC')).toBeNull();
  });

  it('detects ALL-CAPS headings but not ordinary lines', () => {
    expect(isAllCapsHeading('THE ENTRANCE INTO THE KINGDOM')).toBe(true);
    expect(isAllCapsHeading('INTRODUCTORY')).toBe(false); // a single word
    expect(isAllCapsHeading('THE END.')).toBe(false); // sentence punctuation
    expect(isAllCapsHeading('The Kingdom and the Church')).toBe(false);
    expect(isAllCapsHeading('')).toBe(false);
  });
});

describe('quotes and text cleaning', () => {
  it('uses parity and fixes spacing around quotes', () => {
    expect(typographicQuotes('the phrase" kingdom of heaven," and " more "')).toBe(
      'the phrase “kingdom of heaven,” and “more”',
    );
  });

  it('falls back to adjacency when the count is odd', () => {
    expect(typographicQuotes('he said "go on')).toBe('he said “go on');
  });

  it('converts apostrophes', () => {
    expect(typographicQuotes("Jesus' teaching and John's Gospel")).toBe(
      'Jesus’ teaching and John’s Gospel',
    );
  });

  it('applies replacements, word fixes and whitespace normalisation', () => {
    const config = parseIngestConfig({
      replacements: [{ pattern: '\\bd\\. ', replace: 'cf. ' }],
      wordFixes: { tIle: 'the' },
      typographicQuotes: false,
    });
    expect(cleanText('see d.  Mk. i.  tIle   end', config)).toBe('see cf. Mk. i. the end');
  });

  it('splits pages on form feeds and normalises newlines', () => {
    expect(splitPages('a\r\nb\fc\f')).toEqual(['a\nb', 'c']);
  });
});

describe('stable ids', () => {
  const section = (heading: string, texts: string[]) => ({
    ordinal: 0,
    kind: 'chapter' as const,
    heading,
    paragraphs: texts.map((text) => ({ kind: 'p' as const, text })),
  });

  it('lcsPairs aligns equal keys', () => {
    expect(lcsPairs(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it('reuses every id for unchanged content', () => {
    const first = assignIds([section('I. One', ['alpha one two three', 'beta four five six'])]);
    const second = assignIds(
      [section('I. One', ['alpha one two three', 'beta four five six'])],
      first,
    );
    expect(second.sections.map((s) => s.id)).toEqual(first.sections.map((s) => s.id));
    expect(second.paragraphs.map((p) => p.id)).toEqual(first.paragraphs.map((p) => p.id));
    expect(second.created).toBe(0);
  });

  it('keeps ids for lightly edited paragraphs and mints ids for new ones', () => {
    const first = assignIds([
      section('I. One', [
        'the kingdom of God is at hand',
        'second paragraph about faith and repentance',
      ]),
    ]);
    const second = assignIds(
      [
        section('I. One', [
          'the kingdom of God is at hand.',
          'a brand new paragraph inserted here',
          'second paragraph about faith and repentance',
        ]),
      ],
      first,
    );
    expect(second.paragraphs[0]?.id).toBe(first.paragraphs[0]?.id);
    expect(second.paragraphs[2]?.id).toBe(first.paragraphs[1]?.id);
    expect(second.paragraphs[1]?.id).not.toBe(first.paragraphs[0]?.id);
    expect(second.paragraphs[1]?.id).not.toBe(first.paragraphs[1]?.id);
    expect(new Set(second.paragraphs.map((p) => p.id)).size).toBe(3);
  });
});

describe('stable ids when sections are inserted or removed', () => {
  const chapter = (ordinal: number, heading: string, texts: string[]) => ({
    ordinal,
    kind: 'chapter' as const,
    heading,
    paragraphs: texts.map((text) => ({ kind: 'p' as const, text })),
  });
  const a = ['alpha paragraph about grace one', 'alpha paragraph about grace two'];
  const b = ['bravo paragraph about faith one', 'bravo paragraph about faith two'];

  it('keeps every id when a chapter is inserted at the start', () => {
    const first = assignIds([chapter(0, 'I. A', a), chapter(1, 'II. B', b)]);
    const second = assignIds(
      [
        chapter(0, 'Preface', ['a brand new preface paragraph with other words']),
        chapter(1, 'I. A', a),
        chapter(2, 'II. B', b),
      ],
      first,
    );
    expect(second.sections[1]?.id).toBe(first.sections[0]?.id);
    expect(second.sections[2]?.id).toBe(first.sections[1]?.id);
    expect(second.sections[0]?.id).not.toBe(first.sections[0]?.id);
    expect(second.sections[0]?.id).not.toBe(first.sections[1]?.id);
    expect(second.paragraphs.slice(1).map((p) => p.id)).toEqual(first.paragraphs.map((p) => p.id));
    expect(second.created).toBe(2);
  });

  it('keeps the other ids when a chapter is removed from the start', () => {
    const first = assignIds([chapter(0, 'I. A', a), chapter(1, 'II. B', b)]);
    const second = assignIds([chapter(0, 'II. B', b)], first);
    expect(second.sections[0]?.id).toBe(first.sections[1]?.id);
    expect(second.paragraphs.map((p) => p.id)).toEqual(first.paragraphs.slice(2).map((p) => p.id));
    expect(second.created).toBe(0);
  });

  it('falls back to ordinal and kind for a renamed chapter', () => {
    const first = assignIds([chapter(0, 'I. A', a), chapter(1, 'II. B', b)]);
    const second = assignIds([chapter(0, 'I. A', a), chapter(1, 'II. Beta', b)], first);
    expect(second.sections.map((s) => s.id)).toEqual(first.sections.map((s) => s.id));
  });
});

describe('ingest pipeline', () => {
  const meta = {
    work: {
      id: 'WORK',
      slug: 'test-work',
      titleRo: 'Lucrare',
      titleOrig: 'Work',
      author: { name: 'A', born: null, died: null, tradition: 'x' },
      languageOrig: 'en',
      year: 1900,
    },
    edition: {
      id: 'EDITION',
      language: 'en',
      kind: 'source' as const,
      licence: { status: 'public-domain' as const, note: '' },
      provenance: { source: 's', extractedBy: 'e', notes: '' },
    },
  };
  const config = parseIngestConfig({
    endMarker: '^\\s*THE END\\.?\\s*$',
    headers: { minRepeats: 3 },
    chapters: [{ number: 'I', heading: 'First' }],
    paragraphs: { mode: 'layout' },
  });
  const body = (n: number) =>
    [
      `${n}   The Book Title`,
      `   ${['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'][n % 5]} words open page ${n} and carry on with the king-`,
      `dom of heaven number ${n * 7} until the line is full.`,
      'It ends on a short line.',
      '   A new paragraph follows right after.',
    ].join('\n');
  const raw = [
    'TITLE PAGE\nAUTHOR',
    [
      '      CHAPTER I',
      '',
      'First',
      '',
      'It begins with a drop capital line here.',
      '',
      '         7',
    ].join('\n'),
    body(2),
    body(3),
    body(4),
    body(5),
    'THE END.\nINDEX\nA',
  ].join('\f');

  it('drops front matter, heads, indices and builds sections and paragraphs', () => {
    const { pack, report } = ingest({ raw, config, meta });
    expect(pack.sections).toHaveLength(1);
    expect(pack.sections[0]?.heading).toBe('I. First');
    expect(report.frontMatterPages).toBe(1);
    const text = pack.paragraphs.map((p) => p.text).join('\n');
    expect(text).not.toContain('The Book Title');
    expect(text).not.toContain('INDEX');
    expect(text).not.toContain('TITLE PAGE');
    expect(text).toContain('kingdom of heaven');
    expect(pack.paragraphs.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps the front matter on request', () => {
    const { pack } = ingest({ raw, config, meta, keepFrontMatter: true });
    expect(pack.sections.map((s) => s.heading)).toEqual(['Front matter', 'I. First']);
    expect(pack.paragraphs[0]?.text).toContain('TITLE PAGE AUTHOR');
  });

  it('is idempotent: a second run reuses all ids', () => {
    const first = ingest({ raw, config, meta });
    const second = ingest({ raw, config, meta, previous: first.pack });
    expect(second.pack).toEqual(first.pack);
    expect(second.report.idsCreated).toBe(0);
  });

  it('fails loudly when a page fix does not apply', () => {
    const bad = parseIngestConfig({ pageFixes: [{ page: 1, find: 'NOPE', replace: 'x' }] });
    expect(() => applyPageFixes(['text'], bad)).toThrow(/not found/);
    expect(() => applyPageFixes([], bad)).toThrow(/does not exist/);
  });

  it('requires a first chapter marker', () => {
    expect(() => ingest({ raw: 'nothing here', config, meta })).toThrow(/first chapter marker/);
  });

  it('validates the config schema', () => {
    expect(IngestConfigSchema.parse({}).headers.minRepeats).toBe(4);
    expect(() => IngestConfigSchema.parse({ paragraphs: { mode: 'x' } })).toThrow();
  });
});
