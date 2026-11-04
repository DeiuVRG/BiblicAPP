import { describe, expect, it, vi } from 'vitest';

import { buildSources } from '../ask/sources';
import { loadRealLibrary } from '../test-support';
import { phraseBonus, queryPairs, retrieve } from './retrieve';

const library = loadRealLibrary();
const VOS_WORK = library.works[0]!.work.id;

const enEdition = [...library.editions.values()].find((edition) => edition.language === 'en')!;
const roEdition = [...library.editions.values()].find((edition) => edition.language === 'ro')!;

describe('the library built from the real Vos packs', () => {
  it('has the source edition and its aligned Romanian translation', () => {
    expect(library.workCount).toBe(1);
    expect(library.editionCount).toBe(2);
    expect(enEdition.kind).toBe('source');
    expect(roEdition.kind).toBe('translation');
    expect(roEdition.sourceEditionId).toBe(enEdition.editionId);
    expect([...library.indexes.keys()].sort()).toEqual(['en', 'ro']);
    // Every translated paragraph is grouped with the paragraph it renders.
    for (const paragraph of roEdition.paragraphs) {
      const group = library.groups.get(paragraph.groupKey)!;
      expect(group.map((member) => member.editionId).sort()).toEqual(
        [enEdition.editionId, roEdition.editionId].sort(),
      );
    }
  });
});

describe('retrieve: English', () => {
  const result = retrieve(library, 'kingdom of heaven', { language: 'en' });

  it('returns Vos paragraphs, the ones about the kingdom of heaven first', () => {
    expect(result.passages.length).toBeGreaterThanOrEqual(5);
    expect(result.passages.length).toBeLessThanOrEqual(10);
    for (const passage of result.passages) expect(passage.primary.workId).toBe(VOS_WORK);
    const top = result.passages.slice(0, 5).map((passage) => passage.primary.text.toLowerCase());
    expect(top.filter((text) => text.includes('kingdom of heaven')).length).toBeGreaterThanOrEqual(
      2,
    );
    // Chapter III is "The Kingdom of God and the Kingdom of Heaven".
    expect(
      result.passages
        .slice(0, 3)
        .some((passage) => passage.primary.sectionHeading.includes('Kingdom of Heaven')),
    ).toBe(true);
  });

  it('orders by descending score and lists each passage once', () => {
    const scores = result.passages.map((passage) => passage.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(new Set(result.passages.map((passage) => passage.groupKey)).size).toBe(
      result.passages.length,
    );
  });

  it('shows the English version and attaches the Romanian one where it exists', () => {
    for (const passage of result.passages) expect(passage.primary.language).toBe('en');
    const translated = result.passages.filter((passage) => passage.aligned.length > 0);
    for (const passage of translated) {
      expect(passage.aligned).toHaveLength(1);
      expect(passage.aligned[0]?.language).toBe('ro');
    }
  });

  it('respects the limit', () => {
    expect(
      retrieve(library, 'kingdom of heaven', { language: 'en', limit: 3 }).passages,
    ).toHaveLength(3);
  });

  it('folds case and diacritics like the app search', () => {
    const plain = retrieve(library, 'KINGDOM OF HEAVEN', { language: 'en' });
    expect(plain.passages.map((p) => p.groupKey)).toEqual(result.passages.map((p) => p.groupKey));
  });
});

describe('retrieve: the phrase check reads the index, not the text', () => {
  /** The original check: analyse the paragraph again, collect its adjacent pairs, look the query pairs up. */
  function reference(language: string, queryTerms: string[], text: string): number {
    const index = library.indexes.get(language)!;
    const sequence = index.analyzer.analyze(text);
    const pairs = new Set<string>();
    for (let i = 0; i + 1 < sequence.length; i += 1) pairs.add(`${sequence[i]} ${sequence[i + 1]}`);
    let bonus = 0;
    for (let i = 0; i + 1 < queryTerms.length; i += 1) {
      const a = queryTerms[i]!;
      const b = queryTerms[i + 1]!;
      if (a !== b && pairs.has(`${a} ${b}`)) {
        bonus += 0.6 * ((index.index.idf(a) ?? 0) + (index.index.idf(b) ?? 0));
      }
    }
    return bonus;
  }

  it('gives the same bonus as analysing every candidate again', () => {
    const questions: Array<[string, string]> = [
      ['en', 'kingdom of heaven'],
      ['en', 'the kingdom of God and the kingdom of heaven in the teaching of Jesus'],
      ['en', 'repentance and faith; repentance and repentance'],
      ['en', 'xyzzy kingdom xyzzy heaven'],
      ['ro', 'Împărăția cerurilor'],
      ['ro', 'Împărăția lui Dumnezeu și Biserica'],
    ];
    let withBonus = 0;
    for (const [language, question] of questions) {
      const index = library.indexes.get(language)!;
      const terms = index.analyzer.analyze(question);
      const pairs = queryPairs(index, terms);
      index.paragraphs.forEach((paragraph, docIndex) => {
        const bonus = phraseBonus(index.sequences[docIndex]!, pairs);
        expect(bonus, `${language}: ${question} / ${paragraph.id}`).toBeCloseTo(
          reference(language, terms, paragraph.text),
          10,
        );
        if (bonus > 0) withBonus += 1;
      });
    }
    expect(withBonus).toBeGreaterThan(10); // the comparison is not vacuous
  });

  it('does not analyse the text of a single paragraph while answering a question', () => {
    // 80 paragraphs per language were analysed again for every question: about 30 ms of
    // blocking CPU per question, which one machine could not afford under a flood of questions.
    const spies = [...library.indexes.values()].map((index) => vi.spyOn(index.analyzer, 'analyze'));
    try {
      const result = retrieve(library, 'What is the kingdom of heaven according to Vos?', {
        language: 'en',
      });
      expect(result.passages.length).toBeGreaterThan(0);
      const calls = spies.flatMap((spy) => spy.mock.calls.map((call) => String(call[0])));
      expect(calls.length).toBeLessThanOrEqual(6); // the question, once per language (and its parts)
      for (const text of calls) expect(text.length).toBeLessThan(200);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('keeps the vocabulary and sequences parallel to the paragraphs', () => {
    for (const index of library.indexes.values()) {
      expect(index.sequences).toHaveLength(index.paragraphs.length);
      index.paragraphs.forEach((paragraph, docIndex) => {
        expect(index.sequences[docIndex]!.length).toBe(
          index.analyzer.analyze(paragraph.text).length,
        );
      });
    }
  });
});

describe('retrieve: Romanian', () => {
  const result = retrieve(library, 'Împărăția cerurilor', { language: 'ro' });
  /** Passages whose Romanian translation is installed (a translation may cover only some chapters). */
  const translated = new Set(roEdition.paragraphs.map((paragraph) => paragraph.groupKey));

  it('shows the Romanian version of a translated passage, with its English original attached', () => {
    expect(result.passages.length).toBeGreaterThan(0);
    const inRomanian = result.passages.filter((passage) => translated.has(passage.groupKey));
    expect(inRomanian.length).toBeGreaterThan(0);
    for (const passage of inRomanian) {
      expect(passage.primary.language).toBe('ro');
      expect(passage.aligned).toHaveLength(1);
      const original = passage.aligned[0]!;
      expect(original.language).toBe('en');
      expect(original.editionId).toBe(enEdition.editionId);
      // The alignment is the sourceId link of the pack.
      expect(original.id).toBe(passage.primary.passageId);
    }
    expect(inRomanian.some((passage) => passage.primary.text.includes('Împărăția cerurilor'))).toBe(
      true,
    );
  });

  it('shows a passage that is not translated yet in English, found through the glossary', () => {
    // With only the English edition installed the question can only be answered from English
    // passages. The Romanian words are carried over: "Împărăția cerurilor" is searched as
    // "kingdom heaven", which is what chapter III of the book is about.
    const english = retrieve(library, 'Împărăția cerurilor', {
      language: 'ro',
      editionIds: new Set([enEdition.editionId]),
    });
    expect(english.passages.length).toBeGreaterThan(0);
    for (const passage of english.passages) {
      expect(passage.primary.language).toBe('en');
      expect(passage.aligned).toEqual([]);
    }
    expect(
      english.passages
        .slice(0, 3)
        .some((passage) => passage.primary.sectionHeading.includes('Kingdom of Heaven')),
    ).toBe(true);
    expect(english.queries.get('en')).toContain('kingdom');
    expect(english.queries.get('ro')).toBe('Împărăția cerurilor'); // its own language: as asked
  });

  it('works without diacritics', () => {
    const plain = retrieve(library, 'imparatia cerurilor', { language: 'ro' });
    expect(plain.passages.map((p) => p.groupKey)).toEqual(result.passages.map((p) => p.groupKey));
  });

  it('turns passages into numbered sources with the shape the API promises', () => {
    const sources = buildSources(library, result, 'ro');
    const translatedSource = sources.find((entry) => entry.source.language === 'ro')!;
    const first = translatedSource.source;
    expect(first).toMatchObject({
      workId: VOS_WORK,
      editionId: roEdition.editionId,
      language: 'ro',
      kind: 'translation',
      workTitle: 'Învățătura lui Isus despre Împărăția lui Dumnezeu și Biserică',
      author: 'Geerhardus Vos',
      tradition: 'protestant',
    });
    expect(first.sectionHeading).toMatch(/^[IVX]+\. /);
    expect(first.id).toBe(first.aligned[0]?.paragraphId); // the passage id is the original's paragraph id
    expect(first.paragraphId).not.toBe(first.id);
    expect(first.aligned[0]).toMatchObject({
      language: 'en',
      kind: 'source',
      editionId: enEdition.editionId,
    });
    expect(first.excerpt.length).toBeGreaterThan(0);
    // The model reads the Romanian text and the English original.
    expect(translatedSource.original?.language).toBe('en');
    // A passage that exists only in English is offered as it is, under the Romanian title of the
    // work (the answer is in Romanian).
    const englishOnly = buildSources(
      library,
      retrieve(library, 'Împărăția cerurilor', {
        language: 'ro',
        editionIds: new Set([enEdition.editionId]),
      }),
      'ro',
    )[0]!;
    expect(englishOnly.source).toMatchObject({
      language: 'en',
      kind: 'source',
      aligned: [],
      workTitle: 'Învățătura lui Isus despre Împărăția lui Dumnezeu și Biserică',
    });
    expect(englishOnly.original).toBeUndefined();
    expect(
      buildSources(library, retrieve(library, 'kingdom of heaven', { language: 'en' }), 'en')[0]
        ?.source.workTitle,
    ).toBe('The Teaching of Jesus Concerning the Kingdom of God and the Church');
  });
});

describe('retrieve: a Romanian question reaches the English chapters (glossary)', () => {
  // Only chapter I of the book is translated, so before the glossary these questions found nothing
  // but the introduction. They are searched here in the English edition alone, which does not
  // change when the translation grows, and compared with the same question asked in English.
  const only = { editionIds: new Set([enEdition.editionId]) };
  const top = (question: string, language: 'ro' | 'en', count = 5) =>
    retrieve(library, question, { language, ...only }).passages.slice(0, count);
  const headings = (passages: ReturnType<typeof top>) =>
    passages.map((passage) => passage.primary.sectionHeading);

  it.each([
    ['Cum se leagă Împărăția de Biserică?', 'How is the kingdom related to the church?', 'Church'],
    [
      'De ce sunt necesare pocăința și credința?',
      'Why are repentance and faith necessary?',
      'Repentance and Faith',
    ],
    [
      'Este Împărăția prezentă sau viitoare?',
      'Is the kingdom present or future?',
      'Present and the Future',
    ],
  ])('%s', (romanian, english, chapter) => {
    const ro = top(romanian, 'ro');
    const en = top(english, 'en');
    expect(ro.length).toBe(5);
    // The right chapter is among the first three, and most of the first five are from it.
    expect(
      headings(ro)
        .slice(0, 3)
        .some((heading) => heading.includes(chapter)),
    ).toBe(true);
    expect(
      headings(ro).filter((heading) => heading.includes(chapter)).length,
    ).toBeGreaterThanOrEqual(2);
    // And it is the chapter the same question asked in English puts first.
    expect(headings(ro), `${romanian} / ${english}`).toContain(headings(en)[0]);
  });

  it('keeps the English results of an English question as they were', () => {
    // The question is searched as asked in the language of the English index; the glossary only
    // adds the Romanian index (here switched off by the edition filter).
    const en = retrieve(library, 'kingdom of heaven', { language: 'en', ...only });
    const unrestricted = retrieve(library, 'kingdom of heaven', { language: 'en' });
    expect(en.queries.get('en')).toBe('kingdom of heaven');
    expect(unrestricted.passages[0]!.groupKey).toBe(en.passages[0]!.groupKey);
  });

  it('centres the excerpt of an English passage on the words that matched, not on the Romanian ones', () => {
    const sources = buildSources(
      library,
      retrieve(library, 'Cum se leagă Împărăția de Biserică?', { language: 'ro', ...only }),
      'ro',
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const entry of sources.slice(0, 5)) {
      expect(entry.source.language).toBe('en');
      expect(entry.source.excerpt).toMatch(/kingdom|church/i);
    }
  });

  it('keeps names and the words it does not know, and drops the filler of the question', () => {
    const result = retrieve(library, 'Ce spune Vos despre pocăință și Ierusalim?', {
      language: 'ro',
      ...only,
    });
    const searched = result.queries.get('en')!;
    expect(searched).toMatch(/\bvos\b/);
    expect(searched).toMatch(/\brepentance\b/);
    expect(searched).toMatch(/\bjerusalem\b/);
    expect(searched).not.toMatch(/\b(ce|spune|despre)\b/);
  });
});

describe('retrieve: scripture references', () => {
  const cites = (
    paragraphs: ReadonlyArray<{
      refs: Array<{ book: string; chapter: number; from: number | null }>;
    }>,
  ) =>
    paragraphs.some((paragraph) =>
      paragraph.refs.some((ref) => ref.book === 'Matt' && ref.chapter === 4 && ref.from === 17),
    );

  it('finds the paragraphs that cite the verse named in the question, in either notation', () => {
    for (const question of ['Mat. 4:17', 'Matthew 4:17', 'Matei 4:17', 'Matt. iv. 17']) {
      const result = retrieve(library, question, { language: 'en' });
      expect(
        result.refs.map((ref) => `${ref.book} ${ref.chapter}:${ref.from}`),
        question,
      ).toEqual(['Matt 4:17']);
      expect(result.passages.length, question).toBeGreaterThan(0);
      const top = result.passages[0]!;
      expect(cites([top.primary, ...top.aligned]), question).toBe(true);
      expect(top.matchedRefs).toEqual(['Matt 4:17']);
    }
  });

  it('puts a paragraph that cites the verse above paragraphs that only share the words', () => {
    const question = 'What does Matthew 4:17 say about repentance and the kingdom?';
    const result = retrieve(library, question, { language: 'en' });
    const citing = result.passages.filter((passage) =>
      cites([passage.primary, ...passage.aligned]),
    );
    expect(citing.length).toBeGreaterThan(0);
    expect(cites([result.passages[0]!.primary, ...result.passages[0]!.aligned])).toBe(true);
    // Without the reference the same words rank differently.
    const without = retrieve(library, 'What does the text say about repentance and the kingdom?', {
      language: 'en',
    });
    expect(without.passages[0]?.groupKey).not.toBeUndefined();
  });

  it('prefers the asked language when the same verse is cited in both', () => {
    const ro = retrieve(library, 'Mat. 4:17', { language: 'ro' });
    expect(ro.passages[0]?.primary.language).toBe('ro');
    expect(ro.passages[0]?.aligned[0]?.language).toBe('en');
    const en = retrieve(library, 'Mat. 4:17', { language: 'en' });
    expect(en.passages[0]?.primary.language).toBe('en');
  });

  it('does nothing for a verse nobody cites', () => {
    expect(library.references.has('Ruth|1')).toBe(false);
    expect(retrieve(library, 'Rut 1:3', { language: 'ro' }).passages).toEqual([]);
  });

  describe('matchedRefs says only what the passage really cites', () => {
    const citedBy = (passage: {
      primary: { refs: unknown[] };
      aligned: Array<{ refs: unknown[] }>;
    }) =>
      [passage.primary, ...passage.aligned].flatMap(
        (paragraph) =>
          paragraph.refs as Array<{
            book: string;
            chapter: number;
            from: number | null;
            to: number | null;
          }>,
      );

    it('does not claim John 3:16 for passages that cite only other verses of John 3', () => {
      // They rank (same chapter), but a client that shows matchedRefs as "cites John 3:16" must not
      // be told something the text does not say.
      const result = retrieve(library, 'John 3:16', { language: 'en' });
      expect(result.passages.length).toBeGreaterThan(0);
      for (const passage of result.passages) {
        const cites = citedBy(passage).some(
          (ref) =>
            ref.book === 'John' &&
            ref.chapter === 3 &&
            ref.from !== null &&
            ref.from <= 16 &&
            (ref.to ?? ref.from) >= 16,
        );
        expect(cites).toBe(false); // nobody in the library cites John 3:16...
        expect(passage.matchedRefs, 'so none may claim it').toEqual([]);
        expect(passage.score).toBeGreaterThan(0); // ...yet the chapter still ranks them
      }
    });

    it('lists the verse for passages that do cite it, and the chapter for a question about the chapter', () => {
      const verse = retrieve(library, 'Matt 4:17', { language: 'en' });
      expect(verse.passages.length).toBeGreaterThan(0);
      for (const passage of verse.passages) expect(passage.matchedRefs).toEqual(['Matt 4:17']);
      // Asked about the whole chapter, a passage that cites a verse of it cites (part of) it.
      const chapter = retrieve(library, 'Matt 4', { language: 'en' });
      expect(chapter.passages.length).toBeGreaterThan(0);
      for (const passage of chapter.passages) expect(passage.matchedRefs).toEqual(['Matt 4']);
    });

    it('keeps the boost for the weak matches while leaving them out of matchedRefs', () => {
      const strong = retrieve(library, 'Matt 4:17', { language: 'en' }).passages[0]!;
      const weak = retrieve(library, 'Matt 4:99', { language: 'en' }).passages[0]!;
      expect(weak.matchedRefs).toEqual([]);
      expect(weak.score).toBeGreaterThan(0);
      expect(weak.score).toBeLessThan(strong.score);
    });
  });

  it('counts another verse of the same chapter as a weak match', () => {
    const [citing] = [...library.references.get('Matt|4')!];
    const other = citing!.refs.find((ref) => ref.book === 'Matt' && ref.chapter === 4)!;
    const result = retrieve(
      library,
      `Matt ${other.chapter}:${(other.from ?? 1) === 99 ? 98 : 99}`,
      { language: 'en' },
    );
    expect(result.passages.length).toBeGreaterThan(0);
    // Same chapter, different verse: 0.2 of the boost.
    expect(result.passages[0]!.score).toBeLessThan(2);
  });
});

describe('retrieve: filters, follow-ups and silence', () => {
  it('can be restricted to some editions, aligned versions included', () => {
    const onlyEnglish = retrieve(library, 'kingdom of heaven', {
      language: 'en',
      editionIds: new Set([enEdition.editionId]),
    });
    expect(onlyEnglish.passages.length).toBeGreaterThan(0);
    for (const passage of onlyEnglish.passages) expect(passage.aligned).toEqual([]);
    const onlyRomanian = retrieve(library, 'Împărăția cerurilor', {
      language: 'ro',
      editionIds: new Set([roEdition.editionId]),
    });
    expect(onlyRomanian.passages.length).toBeGreaterThan(0);
    for (const passage of onlyRomanian.passages) expect(passage.aligned).toEqual([]);
    // The question is carried over to the language of the only edition that may be searched:
    // "kingdom of heaven" finds the Romanian passages about "Împărăția cerurilor".
    const carriedOver = retrieve(library, 'kingdom of heaven', {
      language: 'en',
      editionIds: new Set([roEdition.editionId]),
    });
    expect(carriedOver.passages.length).toBeGreaterThan(0);
    for (const passage of carriedOver.passages) {
      expect(passage.primary.language).toBe('ro');
      expect(passage.aligned).toEqual([]);
    }
    expect(carriedOver.passages[0]!.primary.text).toContain('Împărăția cerurilor');
    // Nothing in the Romanian edition shares a word with this one, in either language.
    expect(
      retrieve(library, 'xyzzy plugh', {
        language: 'en',
        editionIds: new Set([roEdition.editionId]),
      }).passages,
    ).toEqual([]);
  });

  it('borrows the previous question for a follow-up that has nothing to search for', () => {
    const alone = retrieve(library, 'And what does he say about it?', { language: 'en' });
    expect(alone.passages).toEqual([]);
    const followUp = retrieve(library, 'And what does he say about it?', {
      language: 'en',
      history: ['Tell me about the kingdom of heaven'],
    });
    expect(followUp.usedHistory).toBe(true);
    expect(followUp.passages.length).toBeGreaterThan(0);
    const normal = retrieve(library, 'the kingdom of heaven', {
      language: 'en',
      history: ['unrelated words zzz'],
    });
    expect(normal.usedHistory).toBe(false);
  });

  it('returns nothing when no word of the question occurs in the library', () => {
    expect(retrieve(library, 'xyzzy plugh', { language: 'en' }).passages).toEqual([]);
    expect(retrieve(library, 'ce este asta', { language: 'ro' }).passages).toEqual([]);
    expect(retrieve(library, '   ', { language: 'en' }).passages).toEqual([]);
  });
});
