import { describe, expect, it } from 'vitest';

import type { PromptSource } from '../ask/sources';
import {
  CitationTracker,
  extractQuotations,
  findCitations,
  findQuotations,
  splitSentences,
  stripMarkers,
  verifyQuotations,
  verifyQuotationsByCitation,
} from './citations';

/** Feeds `text` to a tracker in pieces of the given sizes (cycled). */
function feed(text: string, sourceCount: number, sizes: number[]): CitationTracker {
  const tracker = new CitationTracker(sourceCount);
  let at = 0;
  for (let i = 0; at < text.length; i += 1) {
    const size = sizes[i % sizes.length] as number;
    tracker.push(text.slice(at, at + size));
    at += size;
  }
  return tracker;
}

const ANSWER =
  'The kingdom is near, says Vos [1]. It is both present and future [2][3]. Both belong together [1, 3]. See the range [2-3]. A stray [9] and [0] and [sic] do not count.';

describe('CitationTracker', () => {
  it('finds markers, lists and ranges, and ties each to its sentence', () => {
    const { citations, invalidMarkers } = findCitations(ANSWER, 3);
    expect(citations.map((c) => c.sourceIndex)).toEqual([1, 2, 3, 1, 3, 2, 3]);
    expect(citations[0]).toEqual({
      sourceIndex: 1,
      text: 'The kingdom is near, says Vos',
      offset: ANSWER.indexOf('[1]'),
    });
    // "[2][3]" share the claim they follow.
    expect(citations[1]?.text).toBe('It is both present and future');
    expect(citations[2]?.text).toBe('It is both present and future');
    expect(citations[3]?.text).toBe('Both belong together');
    expect(citations[5]?.text).toBe('See the range');
    expect(invalidMarkers).toBe(2); // [9] and [0]; "[sic]" is not a marker at all
  });

  it('gives the same result however the text is cut into deltas', () => {
    const whole = findCitations(ANSWER, 3);
    for (const sizes of [[1], [2], [3], [5], [7, 1, 2], [13, 4], [1, 20], [ANSWER.length]]) {
      const tracker = feed(ANSWER, 3, sizes);
      expect(tracker.citations, JSON.stringify(sizes)).toEqual(whole.citations);
      expect(tracker.invalidMarkers, JSON.stringify(sizes)).toBe(whole.invalidMarkers);
      expect(tracker.answer).toBe(ANSWER);
    }
  });

  it('reports a citation as soon as its closing bracket arrives, not before', () => {
    const tracker = new CitationTracker(5);
    expect(tracker.push('First claim [')).toEqual([]);
    expect(tracker.push('1')).toEqual([]);
    expect(tracker.push(', 2')).toEqual([]);
    const done = tracker.push('] and more');
    expect(done.map((c) => c.sourceIndex)).toEqual([1, 2]);
    expect(tracker.push(' text')).toEqual([]);
    expect(tracker.citations).toHaveLength(2);
  });

  it('does not wait forever on a bracket that is not a marker', () => {
    const tracker = new CitationTracker(5);
    tracker.push('a [note');
    expect(tracker.push(' about it] then [3]').map((c) => c.sourceIndex)).toEqual([3]);
  });

  it('takes the sentence before a marker that follows the full stop', () => {
    const { citations } = findCitations('Faith comes first. Works follow. [2] Then rest.', 3);
    expect(citations).toEqual([{ sourceIndex: 2, text: 'Works follow', offset: 33 }]);
  });

  it('works for Romanian text and for a marker at the very start', () => {
    const { citations } = findCitations('[1] Împărăția este aproape; credința o primește [2].', 2);
    expect(citations.map((c) => c.sourceIndex)).toEqual([1, 2]);
    expect(citations[1]?.text).toBe('credința o primește');
  });

  it('finds a marker with many numbers however it is cut, down to one character at a time', () => {
    // 31 characters: longer than the 24 the first version waited for, so models that stream token
    // by token and cite ten sources at once lost every one of those citations without a trace.
    const text = 'All of them agree [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]. Then one more [2].';
    const whole = findCitations(text, 10);
    expect(whole.citations.map((c) => c.sourceIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 2]);
    for (const size of [1, 2, 3, 4, 5, 7, 11, 24, 30]) {
      const tracker = feed(text, 10, [size]);
      expect(tracker.citations, `pieces of ${size}`).toEqual(whole.citations);
      expect(tracker.invalidMarkers).toBe(0);
    }
    // Every way of cutting the text in two.
    for (let cut = 1; cut < text.length; cut += 1) {
      const tracker = new CitationTracker(10);
      tracker.push(text.slice(0, cut));
      tracker.push(text.slice(cut));
      expect(tracker.citations, `cut at ${cut}`).toEqual(whole.citations);
    }
  });

  it('gives the same result for any random cutting of long markers', () => {
    const text =
      'A [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] B [1–9] C [2 , 4 ; 6 - 8, 10] D [9][8][7] E [3, 3, 3, 3, 3, 3, 3, 3, 3] F.';
    const whole = findCitations(text, 10);
    expect(whole.citations.length).toBeGreaterThan(30);
    let seed = 12345;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 500; round += 1) {
      const sizes = Array.from({ length: 12 }, () => 1 + Math.floor(random() * 9));
      const tracker = feed(text, 10, sizes);
      expect(tracker.citations, JSON.stringify(sizes)).toEqual(whole.citations);
      expect(tracker.invalidMarkers, JSON.stringify(sizes)).toBe(whole.invalidMarkers);
    }
  });

  it('does not wait for a bracket that is far behind, and keeps finding later markers', () => {
    const tracker = new CitationTracker(5);
    tracker.push(`Claim [${'1, '.repeat(80)}`); // never closed: a marker that long is not one
    const found = tracker.push(' and then [2].');
    expect(found.map((c) => c.sourceIndex)).toEqual([2]);
  });

  it('counts a marker that names no source as invalid, not as nothing', () => {
    // [1-100] (absurd range), [3-1] (backwards) and [1-2-3] (a chain) used to vanish silently.
    const { citations, invalidMarkers } = findCitations(
      'One [1-100]. Two [3-1]. Three [1-2-3]. Four [2].',
      5,
    );
    expect(citations.map((c) => c.sourceIndex)).toEqual([2]);
    expect(invalidMarkers).toBe(3);
    // A range inside the sources is still a range, and one that runs past them counts what is out.
    const mixed = findCitations('Five [1-3] and [4-7].', 5);
    expect(mixed.citations.map((c) => c.sourceIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(mixed.invalidMarkers).toBe(2); // 6 and 7
  });

  it('strips markers for the dialogue history', () => {
    expect(stripMarkers('It is near [1][2]. And later [3, 4] again.')).toBe(
      'It is near . And later again.',
    );
  });
});

function source(text: string, original?: string): PromptSource {
  return {
    source: {} as PromptSource['source'],
    context: { year: null, born: null, died: null },
    text,
    ...(original !== undefined
      ? { original: { language: 'en', text: original, paragraphId: 'p' } }
      : {}),
  };
}

describe('quotations', () => {
  const passage =
    'The kingdom of God is the supremacy of God in the sphere of saving power, and nothing else.';
  const sources = [source(passage)];

  it('finds quotations in the usual marks', () => {
    expect(extractQuotations('He said "one" and „doi” and “three” and «four».')).toEqual([
      'one',
      'doi',
      'three',
      'four',
    ]);
  });

  it('accepts a quotation that is word for word in a source, whatever the case and punctuation', () => {
    const answer = 'Vos writes: "the supremacy of GOD in the sphere of saving power" [1].';
    expect(verifyQuotations(answer, sources)).toEqual({ checked: 1, unverified: [] });
    expect(
      verifyQuotations('„Supremacy of God, in the sphere of saving power”', sources).unverified,
    ).toEqual([]);
  });

  it('flags a quotation that is not in any source', () => {
    const result = verifyQuotations(
      'Vos writes: "the kingdom is a purely inner and private feeling of the heart".',
      sources,
    );
    expect(result.checked).toBe(1);
    expect(result.unverified).toHaveLength(1);
  });

  it('checks the pieces of a quotation with an ellipsis one by one', () => {
    const ok = 'He says "the kingdom of God is the supremacy ... and nothing else".';
    expect(verifyQuotations(ok, sources).unverified).toEqual([]);
    const bad = 'He says "the kingdom of God is the supremacy ... and many other things besides".';
    expect(verifyQuotations(bad, sources).unverified).toHaveLength(1);
  });

  it('ignores short quoted terms and answers without quotations', () => {
    expect(verifyQuotations('The word "kingdom" matters.', sources)).toEqual({
      checked: 0,
      unverified: [],
    });
    expect(verifyQuotations('No quotes here [1].', sources)).toEqual({
      checked: 0,
      unverified: [],
    });
  });

  it('also accepts text from the original version of a translated passage', () => {
    const translated = [source('Împărăția lui Dumnezeu este supremația lui Dumnezeu.', passage)];
    expect(
      verifyQuotations('"supremacy of God in the sphere of saving power"', translated).unverified,
    ).toEqual([]);
    expect(verifyQuotations('„supremația lui Dumnezeu”', translated)).toEqual({
      checked: 1,
      unverified: [],
    });
    expect(
      verifyQuotations('„Împărăția lui Dumnezeu este supremația lui Dumnezeu”', translated)
        .unverified,
    ).toEqual([]);
  });
});

describe('findQuotations', () => {
  it('tells where each quotation sits, marks included', () => {
    const answer = 'He said "one thing" and „alta” too.';
    const found = findQuotations(answer);
    expect(found.map((quote) => quote.text)).toEqual(['one thing', 'alta']);
    expect(answer[found[0]!.start]).toBe('"');
    expect(answer[found[0]!.end]).toBe('"');
    expect(answer.slice(found[1]!.start, found[1]!.end + 1)).toBe('„alta”');
  });
});

describe('splitSentences', () => {
  const cut = (answer: string): string[] =>
    splitSentences(answer).map((sentence) => answer.slice(sentence.start, sentence.end).trim());

  it('cuts after . ! ? and … when a new sentence starts, and at line breaks', () => {
    expect(cut('It is near. Is it here? It is! Yes… But later.\nNext line')).toEqual([
      'It is near.',
      'Is it here?',
      'It is!',
      'Yes…',
      'But later.',
      'Next line',
    ]);
    expect(cut('')).toEqual([]);
    expect(cut('   \n  ')).toEqual([]);
  });

  it('does not cut after an abbreviation, an initial, a verse reference or inside a number', () => {
    expect(cut('Paul met St. Peter in Antioch. Then he left.')).toEqual([
      'Paul met St. Peter in Antioch.',
      'Then he left.',
    ]);
    expect(cut('G. Vos wrote it. Next.')).toEqual(['G. Vos wrote it.', 'Next.']);
    expect(cut('See Matt. 4:17 and Mat. 6:33. Then rest.')).toEqual([
      'See Matt. 4:17 and Mat. 6:33.',
      'Then rest.',
    ]);
    expect(cut('Pi is 3.14 roughly. Done.')).toEqual(['Pi is 3.14 roughly.', 'Done.']);
    expect(cut('It is near, i.e. here. Done.')).toEqual(['It is near, i.e. here.', 'Done.']);
    expect(cut('Some, e.g. Ritschl, disagree [2]. Done.')).toEqual([
      'Some, e.g. Ritschl, disagree [2].',
      'Done.',
    ]);
  });

  it('does not cut inside a quotation, and keeps citation markers with the sentence they follow', () => {
    expect(cut('He wrote "First idea. Second idea!" and left. Then more [1].')).toEqual([
      'He wrote "First idea. Second idea!" and left.',
      'Then more [1].',
    ]);
    expect(cut('Works follow. [2] Then rest. [1][3] End.')).toEqual([
      'Works follow. [2]',
      'Then rest. [1][3]',
      'End.',
    ]);
  });

  it('ends the sentence at a quotation that ends with its own full stop', () => {
    expect(cut('He said "it is near." Then he left [1].')).toEqual([
      'He said "it is near."',
      'Then he left [1].',
    ]);
    // ...but not when the sentence goes on in lower case.
    expect(cut('"It is near." says Vos [1]. Done.')).toEqual([
      '"It is near." says Vos [1].',
      'Done.',
    ]);
  });
});

describe('verifyQuotationsByCitation', () => {
  const first =
    'The kingdom of God is the supremacy of God in the sphere of saving power, and nothing else.';
  const second =
    'Repentance is a change of mind that turns the whole person away from sin towards God himself.';
  const sources = [source(first), source(second)];

  it('accepts a quotation found in the source its sentence cites', () => {
    const answer =
      'Vos writes "the supremacy of God in the sphere of saving power" [1]. ' +
      'He adds that "a change of mind that turns the whole person away from sin" [2].';
    expect(verifyQuotationsByCitation(answer, sources)).toEqual({
      checked: 2,
      uncited: 0,
      unverified: [],
    });
  });

  it('catches a quotation that is in the sources but not in the one its sentence cites', () => {
    const answer = 'Vos writes "the supremacy of God in the sphere of saving power" [2].';
    // The old check looked at every source and was satisfied...
    expect(verifyQuotations(answer, sources).unverified).toEqual([]);
    // ...this one looks at source 2 only.
    const result = verifyQuotationsByCitation(answer, sources);
    expect(result.checked).toBe(1);
    expect(result.uncited).toBe(0);
    expect(result.unverified).toEqual([
      {
        text: 'the supremacy of God in the sphere of saving power',
        sentence: 0,
        offset: answer.indexOf('"'),
        cited: [2],
      },
    ]);
  });

  it('checks the quotations of a sentence against all the sources that sentence cites', () => {
    const answer =
      'He says "the supremacy of God in the sphere of saving power" and ' +
      '"a change of mind that turns the whole person away from sin" [1, 2].';
    expect(verifyQuotationsByCitation(answer, sources).unverified).toEqual([]);
    const ranged = answer.replace('[1, 2]', '[1-2]');
    expect(verifyQuotationsByCitation(ranged, sources).unverified).toEqual([]);
    // One marker is not enough for a sentence that quotes both.
    const only = answer.replace('[1, 2]', '[1]');
    const result = verifyQuotationsByCitation(only, sources);
    expect(result.unverified.map((quote) => quote.text)).toEqual([
      'a change of mind that turns the whole person away from sin',
    ]);
    expect(result.unverified[0]!.cited).toEqual([1]);
  });

  it('falls back to all the sources for a sentence that cites none, and says so', () => {
    const answer =
      'Vos writes "the supremacy of God in the sphere of saving power". It matters [1]. ' +
      'Elsewhere "a quotation that no source contains at all, anywhere" appears.';
    const result = verifyQuotationsByCitation(answer, sources);
    expect(result.checked).toBe(2);
    expect(result.uncited).toBe(2);
    expect(result.unverified).toHaveLength(1);
    expect(result.unverified[0]).toMatchObject({ sentence: 2, cited: [] });
    // A marker that names no source does not count as a citation either.
    const invalid = verifyQuotationsByCitation(
      'He writes "the supremacy of God in the sphere of saving power" [9][0].',
      sources,
    );
    expect(invalid).toMatchObject({ checked: 1, uncited: 1, unverified: [] });
  });

  it('takes a marker that follows the full stop as the citation of the sentence before it', () => {
    const answer = 'Vos writes "the supremacy of God in the sphere of saving power". [2] Next [1].';
    expect(verifyQuotationsByCitation(answer, sources).unverified).toMatchObject([
      { sentence: 0, cited: [2] },
    ]);
  });

  it('keeps a quotation of several sentences whole and checks it with the sentence that holds it', () => {
    const long = source(
      'Faith is a conviction. It also involves the recognition of the willingness of God to save.',
    );
    const answer =
      'He explains "Faith is a conviction. It also involves the recognition of the willingness of God" [1].';
    expect(verifyQuotationsByCitation(answer, [long]).unverified).toEqual([]);
    expect(verifyQuotationsByCitation(answer, [long, ...sources]).checked).toBe(1);
  });

  it('accepts text from the original of a translated source when that source is cited', () => {
    const translated = [
      source('Împărăția lui Dumnezeu este supremația lui Dumnezeu.', first),
      ...sources,
    ];
    const answer = 'Vos writes "supremacy of God in the sphere of saving power" [1].';
    expect(verifyQuotationsByCitation(answer, translated).unverified).toEqual([]);
    expect(
      verifyQuotationsByCitation('„supremația lui Dumnezeu” [1]. Apoi încă ceva.', translated),
    ).toMatchObject({ checked: 1, unverified: [] });
  });

  it('leaves short quoted terms alone and reports nothing for an answer without quotations', () => {
    expect(verifyQuotationsByCitation('The word "kingdom" matters [1].', sources)).toEqual({
      checked: 0,
      uncited: 0,
      unverified: [],
    });
    expect(verifyQuotationsByCitation('No quotes here [1].', sources)).toEqual({
      checked: 0,
      uncited: 0,
      unverified: [],
    });
  });

  it('reports where the quotation is: its sentence and the position of its opening mark', () => {
    const answer =
      'First a plain sentence [1]. Then Vos writes "a made up line that is nowhere in any source" [2].';
    const [item] = verifyQuotationsByCitation(answer, sources).unverified;
    expect(item).toMatchObject({ sentence: 1, cited: [2] });
    expect(answer.slice(item!.offset, item!.offset + 1)).toBe('"');
    expect(answer.slice(item!.offset + 1, item!.offset + 6)).toBe('a mad');
  });
});
