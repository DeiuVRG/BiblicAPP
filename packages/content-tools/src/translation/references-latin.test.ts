import { describe, expect, it } from 'vitest';

import { defined } from '../lib/invariant';
import { extractReferences, findUnparsedFragments, parseReferences } from './notation';
import { LATIN_BOOK_CITATIONS } from './reference-fixtures';

const toEn = (text: string) => parseReferences(text, { source: 'la', target: 'en' });
const toRo = (text: string) => parseReferences(text, { source: 'la', target: 'ro' });
const one = (text: string) => {
  const runs = toEn(text);
  expect(runs, text).toHaveLength(1);
  return defined(runs[0], 'the run');
};

/** [Latin run, English rendering, Romanian rendering, canonical items] */
const FORMS: [string, string, string, string[]][] = [
  ['Matth. IV, 17', 'Matt. 4:17', 'Mat. 4:17', ['Matt 4:17']],
  ['Ioh. 3, 5', 'John 3:5', 'In. 3:5', ['John 3:5']],
  ['Rom. v. 12', 'Rom. 5:12', 'Rom. 5:12', ['Rom 5:12']],
  ['Ps. 118, 2', 'Ps. 118:2', 'Ps. 118:2', ['Ps 118:2 vulgate']],
  ['I Cor. xv, 22', '1 Cor. 15:22', '1 Cor. 15:22', ['1Cor 15:22']],
  ['1 Cor. 15, 22', '1 Cor. 15:22', '1 Cor. 15:22', ['1Cor 15:22']],
  ['Ioh. 3, 5 sq.', 'John 3:5 ff.', 'In. 3:5 ș.urm.', ['John 3:5ff']],
  ['Rom. viii. 19 sqq.', 'Rom. 8:19 ff.', 'Rom. 8:19 ș.urm.', ['Rom 8:19ff']],
];

describe('the forms of the specification', () => {
  it.each(FORMS)('%s', (source, english, romanian, canonical) => {
    const [run] = toEn(`Vide ${source}. Et sic porro.`);
    expect(run).toMatchObject({ source, target: english, canonical });
    expect(toRo(`Vide ${source}. Et sic porro.`)[0]).toMatchObject({ source, target: romanian });
  });

  it('reports offsets that slice the run out of the text', () => {
    const text = 'ut dicit Apostolus, Rom. v. 12; vi. 3, et alibi.';
    const [run] = toEn(text);
    expect(run && text.slice(run.start, run.end)).toBe('Rom. v. 12; vi. 3');
  });

  it('writes a Romanian run in Romanian abbreviations and an English run in English ones', () => {
    const [run] = toEn('Ioh. 3, 5; 4, 14');
    expect(run?.target).toBe('John 3:5; 4:14');
    expect(toRo('Ioh. 3, 5; 4, 14')[0]?.target).toBe('In. 3:5; 4:14');
  });
});

describe('every book of the specification', () => {
  it.each(LATIN_BOOK_CITATIONS)('%s is %s', (citation, canonical) => {
    expect(toEn(`ut ${citation}, dicit`).map((r) => r.canonical)).toEqual([[canonical]]);
  });
});

describe('Latin grammar details', () => {
  it('reads roman chapters in either case and arabic chapters, with the separators of the editions', () => {
    for (const form of [
      'Matth. IV, 17',
      'Matth. iv, 17',
      'Matth. IV. 17',
      'Matth. iv. 17',
      'Matth. 4, 17',
      'Matth. 4,17',
      'Matth. 4:17',
      'Matth. c. 4, 17',
      'Matth. cap. IV, 17',
      'Matth. 4, v. 17',
    ]) {
      expect(one(form).canonical, form).toEqual(['Matt 4:17']);
    }
    expect(one('Ps. CXVIII, 2').canonical).toEqual(['Ps 118:2 vulgate']);
  });

  it('accepts a roman or arabic number before a numbered book, with or without a period', () => {
    for (const form of ['I Cor. 15, 22', '1 Cor. 15, 22', '1Cor. 15, 22', 'I. Cor. 15, 22']) {
      expect(one(form).canonical, form).toEqual(['1Cor 15:22']);
    }
    expect(one('II Cor. 3, 6').canonical).toEqual(['2Cor 3:6']);
    expect(one('III Ioh. 4').canonical).toEqual(['3John 4']);
  });

  it('refuses invalid roman numerals and chapters beyond 150', () => {
    for (const text of ['Matth. IIII, 3', 'Matth. IC, 3', 'Matth. Xi, 3', 'Matth. 151, 3']) {
      expect(toEn(text), text).toEqual([]);
    }
  });

  it('reads verse lists with a comma, a period before a number, "et" and "&", and ranges', () => {
    expect(one('Rom. 5, 12, 14').canonical).toEqual(['Rom 5:12', 'Rom 5:14']);
    expect(one('Ioh. 3, 5. 8').canonical).toEqual(['John 3:5', 'John 3:8']);
    expect(one('Ioh. 3, 5 et 8').canonical).toEqual(['John 3:5', 'John 3:8']);
    expect(one('Ioh. 3, 5 & 8').canonical).toEqual(['John 3:5', 'John 3:8']);
    expect(one('Rom. v. 12 et 14').canonical).toEqual(['Rom 5:12', 'Rom 5:14']);
    expect(one('Rom. 5, 12-14').canonical).toEqual(['Rom 5:12-14']);
    expect(one('Rom. 5, 12–14').canonical).toEqual(['Rom 5:12-14']);
    expect(one('Rom. 5, 12-14, 18').target).toBe('Rom. 5:12–14, 18');
  });

  it('reads "et" before a chapter and verse as a new chapter, not as two more verses', () => {
    expect(one('Matth. 5, 3 et 6, 1').canonical).toEqual(['Matt 5:3', 'Matt 6:1']);
    expect(one('Matth. 5, 3 et 6, 1').target).toBe('Matt. 5:3 and 6:1');
    expect(toRo('Matth. 5, 3 et 6, 1')[0]?.target).toBe('Mat. 5:3 și 6:1');
    expect(one('Matth. 5, 3 et 6, 1').source).toBe('Matth. 5, 3 et 6, 1');
    // a number with nothing after it is still a verse
    expect(one('Matth. 5, 3 et 6').canonical).toEqual(['Matt 5:3', 'Matt 5:6']);
    expect(one('Matth. 5, 3 et 6-8').canonical).toEqual(['Matt 5:3', 'Matt 5:6-8']);
  });

  it('keeps the full stop of the sentence out of the run', () => {
    const text = 'Dicit Apostolus (Rom. 5, 12). Et iterum.';
    const [run] = toEn(text);
    expect(run?.source).toBe('Rom. 5, 12');
    expect(toEn('Vide Ioh. 3, 5. Dixit autem Iesus')[0]?.source).toBe('Ioh. 3, 5');
  });

  it('reads "and the following" as ff: sq., sqq., seq., seqq., ss., ff., f., also after "et"', () => {
    for (const marker of ['sq.', 'sqq.', 'seq.', 'seqq.', 'ss.', 'ff.', 'f.', 'sqq', 'et sqq.']) {
      const run = one(`Rom. viii. 19 ${marker} et cetera`);
      expect(run.canonical, marker).toEqual(['Rom 8:19ff']);
      expect(run.target, marker).toBe('Rom. 8:19 ff.');
    }
    expect(toEn('Rom. viii. 19 sqqx')[0]?.canonical).toEqual(['Rom 8:19']);
  });

  it('continues a run with a chapter of the same book after a semicolon', () => {
    expect(one('Matth. 5, 3; 6, 1; 7, 2').canonical).toEqual(['Matt 5:3', 'Matt 6:1', 'Matt 7:2']);
    expect(one('Matth. 5, 3; 6, 1; 7, 2').target).toBe('Matt. 5:3; 6:1; 7:2');
    expect(one('Rom. v. 12; vi. 3').canonical).toEqual(['Rom 5:12', 'Rom 6:3']);
    expect(one('Is. xxiv. 21; xliii. 15; Mich. ii. 12; iv. 6; Abd. 21').canonical).toEqual([
      'Isa 24:21',
      'Isa 43:15',
      'Mic 2:12',
      'Mic 4:6',
      'Obad 21',
    ]);
  });

  it('continues with a roman chapter after a comma, but never with an arabic number', () => {
    expect(one('Rom. v. 12, vi. 3').canonical).toEqual(['Rom 5:12', 'Rom 6:3']);
    expect(one('Rom. v. 12, vi. 3').target).toBe('Rom. 5:12; 6:3');
    // `, 14` is the next verse of the list, not a chapter
    expect(one('Rom. 5, 12, 14').canonical).toEqual(['Rom 5:12', 'Rom 5:14']);
  });

  it('does not let a bare chapter start a run', () => {
    expect(toEn('ut dicit, iv, 17, et alibi')).toEqual([]);
    expect(toEn('in capite 5, 3 homines')).toEqual([]);
    expect(toEn('xviii. 36')).toEqual([]);
  });

  it('continues with v. and vv. (verses of the chapter before), also after "et" and "cum"', () => {
    expect(one('Rom. 5, 12; v. 14').canonical).toEqual(['Rom 5:12', 'Rom 5:14']);
    expect(one('Rom. 5, 12; v. 14').target).toBe('Rom. 5:12; v. 14');
    expect(one('Rom. 5, 12; vv. 14-16').target).toBe('Rom. 5:12; vv. 14–16');
    expect(one('Apoc. 3, 20 cum v. 21').target).toBe('Rev. 3:20 with v. 21');
    expect(toRo('Apoc. 3, 20 cum v. 21')[0]?.target).toBe('Apoc. 3:20 cu v. 21');
    expect(one('Ioh. 3, 5 et v. 7').target).toBe('John 3:5 and v. 7');
    expect(toRo('Ioh. 3, 5 et v. 7')[0]?.target).toBe('In. 3:5 și v. 7');
    expect(one('Ioh. 3, 5, vv. 7-8').canonical).toEqual(['John 3:5', 'John 3:7-8']);
  });

  it('lets v. stand alone and inherit the last reference of the paragraph, or stay unresolved', () => {
    const inherited = toEn('Ioh. 3, 5 (vide Rom. 5, 12). Cf. v. 14 et alibi.');
    expect(inherited.map((r) => r.canonical)).toEqual([['John 3:5'], ['Rom 5:12'], ['Rom 5:14']]);
    expect(toEn('ut supra v. 19 dictum est')[0]).toMatchObject({
      target: 'v. 19',
      canonical: ['vs 19'],
    });
  });

  it('reads "ibid." (also "ib." and "ibidem") like the reference before it', () => {
    const inside = one('Rom. 5, 12; ibid. 14');
    expect(inside.canonical).toEqual(['Rom 5:12', 'Rom 5:14']);
    expect(inside.target).toBe('Rom. 5:12; v. 14');
    for (const word of ['ibid.', 'ib.', 'ibidem', 'Ibid.', 'ibid']) {
      const runs = toEn(`Rom. 5, 12. ${word} 14 sqq.`);
      expect(
        runs.map((r) => r.canonical),
        word,
      ).toEqual([['Rom 5:12'], ['Rom 5:14ff']]);
      expect(runs[1]?.target, word).toBe('Rom. 5:14 ff.');
    }
  });

  it('gives ibid. at the start of a run the book of the reference before it, explicitly', () => {
    const runs = toEn('Ioh. 3, 5. Et ibid. 6, 3; 7, 8 sq. Et ibid. vi, 20.');
    expect(runs.map((r) => r.target)).toEqual(['John 3:5', 'John 6:3; 7:8 ff.', 'John 6:20']);
    expect(runs.map((r) => r.canonical)).toEqual([
      ['John 3:5'],
      ['John 6:3', 'John 7:8ff'],
      ['John 6:20'],
    ]);
    expect(toRo('Ioh. 3, 5. Et ibid. 6, 3')[1]?.target).toBe('In. 6:3');
    // verses only: the chapter of the reference before it
    const verses = toEn('Rom. 5, 12. Cf. ibid. 14-16');
    expect(verses[1]).toMatchObject({ target: 'Rom. 5:14–16', canonical: ['Rom 5:14-16'] });
  });

  it('leaves ibid. unresolved when nothing comes before it', () => {
    expect(toEn('ibid. 14')[0]).toMatchObject({ target: 'v. 14', canonical: ['vs 14'] });
    expect(toEn('ibid. et alibi')).toEqual([]);
    expect(toEn('ut ibid. dictum est')).toEqual([]);
  });

  it('carries an unresolved ibid. and chapter over as "Ibid. 6:3", not as a bare 6:3', () => {
    // a bare chapter and verse says nothing in a translation, and in English it cannot even be
    // read back (`10:30` is a time): the word that makes it a reference stays
    for (const toTarget of [toEn, toRo]) {
      expect(toTarget('ibid. 6, 3')[0]).toMatchObject({ target: 'Ibid. 6:3', canonical: ['6:3'] });
      expect(toTarget('Ibid. vi, 3 sq.')[0]).toMatchObject({
        target: toTarget === toEn ? 'Ibid. 6:3 ff.' : 'Ibid. 6:3 ș.urm.',
        canonical: ['6:3ff'],
      });
      expect(toTarget('ibidem 6, 3; 7, 1')[0]).toMatchObject({
        target: 'Ibid. 6:3; 7:1',
        canonical: ['6:3', '7:1'],
      });
    }
    // an ibid. that has an antecedent is a full reference, and a chapter after `;` stays bare
    expect(toEn('Rom. 5, 12. Et ibid. 6, 3')[1]?.target).toBe('Rom. 6:3');
    expect(toEn('Rom. 5, 12; ibid. 6, 3')[0]?.target).toBe('Rom. 5:12; 6:3');
  });

  it('writes an unresolved ibid. so that the translation reads back the same items', () => {
    for (const target of ['en', 'ro'] as const) {
      for (const latin of ['ibid. 6, 3', 'Ibid. vi, 3', 'ib. 6, 3 sq.', 'ibidem 6, 3-5; 7, 1']) {
        const [run] = parseReferences(latin, { source: 'la', target });
        const written = defined(run, latin).target;
        const read = extractReferences(`The Apostle says (${written}) in this place.`, target);
        expect(
          read.flatMap((r) => r.canonical),
          `${target}: ${latin} -> ${written}`,
        ).toEqual(run?.canonical);
      }
    }
    // in the notation of the translation `Ibid.` also takes the book of the run before it
    expect(
      extractReferences('See Rom. 5:12. Ibid. 6:3 follows.', 'en').map((r) => r.canonical),
    ).toEqual([['Rom 5:12'], ['Rom 6:3']]);
    // ...but is not read without chapter and verses, and the English 6:3 alone is still no reference
    expect(extractReferences('Ibid. is a Latin word, as in ibid. 6 times.', 'en')).toEqual([]);
    expect(extractReferences('It happened at 6:3 in the morning.', 'en')).toEqual([]);
  });

  it('reads a comma after ibid. ("ibid., 14")', () => {
    for (const text of [
      'Rom. 5, 12; ibid., 14',
      'Rom. 5, 12; ibid. , 14',
      'Rom. 5, 12. Ibid., 14',
    ]) {
      const items = toEn(text).flatMap((r) => r.canonical);
      expect(items, text).toEqual(['Rom 5:12', 'Rom 5:14']);
      expect(findUnparsedFragments(text, 'la'), text).toEqual([]);
    }
  });

  it('does not swallow the number of the next book', () => {
    for (const text of [
      'Rom. 5, 12, 1 Cor. 15, 22',
      'Rom. 5, 12. 1 Cor. 15, 22',
      'Rom. 5, 12; 1 Cor. 15, 22',
    ]) {
      const runs = toEn(text);
      const items = runs.flatMap((r) => r.canonical);
      expect(items, text).toEqual(['Rom 5:12', '1Cor 15:22']);
    }
    expect(toEn('Matth. 5, 3. 1 homo venit')[0]?.canonical).toEqual(['Matt 5:3', 'Matt 5:1']);
  });

  it('names a chapter without verses only when the citation ends there', () => {
    expect(one('Matth. V').canonical).toEqual(['Matt 5']);
    expect(one('in Rom. VIII.').canonical).toEqual(['Rom 8']);
    expect(one('(Ioh. 3)').canonical).toEqual(['John 3']);
    expect(one('Ioh. XIII, ubi dicit').canonical).toEqual(['John 13']);
    expect(toEn('Ruth V quod dicit')).toEqual([]);
    expect(toEn('Rom. VIII quod dicit')).toEqual([]);
    expect(toEn('Ruth 3 homines')).toEqual([]);
    // "I Cor." is a book with a number, not chapter I of Romans
    expect(toEn('Rom. I Cor. 3, 4').map((r) => r.canonical)).toEqual([['1Cor 3:4']]);
  });

  it('reads single-chapter books as book and verses', () => {
    expect(one('Iud. 5').canonical).toEqual(['Jude 5']);
    expect(one('Abd. 21').canonical).toEqual(['Obad 21']);
    expect(one('2 Ioh. 5').canonical).toEqual(['2John 5']);
    expect(one('Philem. 10-12').canonical).toEqual(['Phlm 10-12']);
    expect(one('Abd. 1:21').canonical).toEqual(['Obad 21']);
    expect(toEn('Abd. 2:21')).toEqual([]);
    // a comma lists verses, as in the English notation
    expect(one('Iud. 3, 5').canonical).toEqual(['Jude 3', 'Jude 5']);
  });

  it('reads "1, 3" after a single-chapter book as chapter 1, verse 3, with a note', () => {
    // the Latin way of citing chapter and verse: the only chapter of the book is 1
    for (const [text, canonical, target] of [
      ['Abd. 1, 3', ['Obad 3'], 'Obad. 3'],
      ['Philem. 1, 5', ['Phlm 5'], 'Philem. 5'],
      ['Iud. 1, 5', ['Jude 5'], 'Jude 5'],
      ['2 Ioh. 1, 4', ['2John 4'], '2 John 4'],
      ['Abd. 1.3', ['Obad 3'], 'Obad. 3'],
      ['Abd. 1, 3-5', ['Obad 3-5'], 'Obad. 3–5'],
      ['Abd. 1, 3, 5', ['Obad 3', 'Obad 5'], 'Obad. 3, 5'],
    ] as const) {
      const run = one(text);
      expect(run.canonical, text).toEqual(canonical);
      expect(run.target, text).toBe(target);
      expect(run.notes?.join(' '), text).toContain('chapter 1, verse');
    }
    // the note is added to the one of Jude, not instead of it
    expect(one('Iud. 1, 5').notes?.join(' ')).toMatch(/Epistle of Jude.*chapter 1, verse 3/);
    // what is not the Latin way stays as it was: no note, same items
    expect(one('Abd. 21').notes).toBeUndefined();
    expect(one('Abd. 1').canonical).toEqual(['Obad 1']);
    expect(one('Abd. 1:21').notes).toBeUndefined();
    expect(one('Iud. 3, 5').notes?.join(' ')).not.toContain('chapter 1');
    expect(one('Iud. 1 et 5').canonical).toEqual(['Jude 1', 'Jude 5']);
    // a book of several chapters is not touched
    expect(one('Ioh. 1, 3').canonical).toEqual(['John 1:3']);
  });

  it('is deterministic and stateless between calls', () => {
    const text = 'Rom. 5, 12; ibid. 14 et Ioh. 3, 5. Cf. ibid. 6, 3 sq.';
    expect(toEn(text)).toEqual(toEn(text));
    expect(toEn('ibid. 14')).toEqual(toEn('ibid. 14'));
  });
});

describe('the numbering of the Vulgate', () => {
  it('keeps the number of a psalm and marks it, with a note for the translator', () => {
    const run = one('Ps. 118, 2');
    expect(run.canonical).toEqual(['Ps 118:2 vulgate']);
    expect(run.target).toBe('Ps. 118:2');
    expect(run.notes).toHaveLength(1);
    expect(run.notes?.[0]).toMatch(
      /Vulgate psalm numbering.*keep the number of the source.*do not renumber/,
    );
    expect(toRo('Ps. 118, 2')[0]?.target).toBe('Ps. 118:2');
  });

  it('marks every item of a psalm run, also the verses and chapters that continue it', () => {
    const run = one('Ps. 118, 2. 5; 119, 1; v. 3');
    expect(run.canonical).toEqual([
      'Ps 118:2 vulgate',
      'Ps 118:5 vulgate',
      'Ps 119:1 vulgate',
      'Ps 119:3 vulgate',
    ]);
    expect(run.notes).toHaveLength(1);
    expect(one('Ps. CXVIII').canonical).toEqual(['Ps 118 vulgate']);
  });

  it('carries the marker and the note over to ibid.', () => {
    const runs = toEn('Ps. 22, 1. Item ibid. 4.');
    expect(runs[1]).toMatchObject({ target: 'Ps. 22:4', canonical: ['Ps 22:4 vulgate'] });
    expect(runs[1]?.notes).toHaveLength(1);
  });

  it('writes 1-4 Reg. as 1-2 Samuel and 1-2 Kings and says so', () => {
    const run = one('1 Reg. 3, 4; 2 Reg. 1, 1; 3 Reg. 19, 12; 4 Reg. 2, 11');
    expect(run.target).toBe('1 Sam. 3:4; 2 Sam. 1:1; 1 Kings 19:12; 2 Kings 2:11');
    expect(run.canonical).toEqual([
      '1Sam 3:4 vulgate',
      '2Sam 1:1 vulgate',
      '1Kgs 19:12 vulgate',
      '2Kgs 2:11 vulgate',
    ]);
    expect(run.notes).toHaveLength(1);
    expect(run.notes?.[0]).toMatch(/3 and 4 Reg\. are 1 and 2 Kings/);
    expect(toRo('3 Reg. 19, 12')[0]?.target).toBe('1 Împ. 19:12');
    expect(toRo('IV Reg. 2, 11')[0]?.target).toBe('2 Împ. 2:11');
  });

  it('reads Esdras by the numbering of the Vulgate and Paralipomenon as Chronicles', () => {
    expect(one('Esdr. 3, 4').canonical).toEqual(['Ezra 3:4 vulgate']);
    expect(one('2 Esdr. 8, 10').canonical).toEqual(['Neh 8:10 vulgate']);
    expect(one('2 Esdr. 8, 10').notes?.[0]).toMatch(/2 Esdr\. is Nehemiah/);
    const chronicles = one('2 Par. 7, 14');
    expect(chronicles.canonical).toEqual(['2Chr 7:14']);
    expect(chronicles.notes).toBeUndefined();
  });

  it('warns that Iud. is Jude and not Judges', () => {
    const run = one('Iud. 5');
    expect(run.notes?.[0]).toMatch(/Epistle of Jude.*Judges is Iudic/);
    expect(one('Iudic. 6, 12').notes).toBeUndefined();
  });

  it('puts no note on references that need none', () => {
    for (const text of ['Matth. 5, 3', 'Rom. v. 12', 'Is. 7, 14']) {
      expect(one(text).notes, text).toBeUndefined();
    }
  });
});

describe('ordinary Latin is not scripture', () => {
  it('does not take words that are abbreviations for references', () => {
    for (const text of [
      'Is est qui venit, et Os eius locutum est.',
      'Am I not? Ex quo factum est, Num quid dixit?',
      'Dan et Iob et Ruth et Esther fuerunt.',
      'Quae cum ita sint, ad Romanos scripsit.',
      'in capite quinto, versu tertio, secundum Ioannem',
      'anno 412, post Christum natum, libro 2, capite 3',
      'Est autem v. d. et c. 5 non est locus.',
    ]) {
      expect(toEn(text), text).toEqual([]);
    }
  });

  it('finds no reference in the Latin of the first chapter of De spiritu et littera', () => {
    const text =
      'Lectis opusculis, quae ad te nuper elaboravi, fili charissime Marcelline, de Baptismo ' +
      'parvulorum, et de perfectione justitiae hominis, quod eam nemo in hac vita vel ' +
      'assecutus, vel assecuturus videatur, excepto uno Mediatore, qui humana perpessus est in ' +
      'similitudine carnis peccati, sine ullo omnino peccato: rescripsisti te moveri eo.';
    expect(toEn(text)).toEqual([]);
    expect(findUnparsedFragments(text, 'la')).toEqual([]);
  });
});

describe('reference-like fragments that did not parse (Latin)', () => {
  it('reports a numbered book without its number, a dual numbering and a malformed chapter', () => {
    for (const text of [
      'ut dicit Par. 3, 4 supra',
      'Ps. 22 (23), 1',
      'Matth. 5, 3x',
      'ut Rom, vi. 3 sq. dicit',
    ]) {
      expect(findUnparsedFragments(text, 'la'), text).not.toEqual([]);
    }
  });

  it('reports nothing for what parses, also when the next citation follows a comma', () => {
    expect(findUnparsedFragments('Rom. 5, 12, 1 Cor. 15, 22 et Ioh. 3, 5 sq.', 'la')).toEqual([]);
    expect(findUnparsedFragments('Ioh. 3, 5; ibid. 8; v. 9', 'la')).toEqual([]);
  });

  it('reports a number that a cut-short run left behind', () => {
    expect(findUnparsedFragments('Ioh. 3, 5, 200 homines', 'la')).toHaveLength(1);
  });

  it('reports a verse that a period and a space cut off from its chapter ("Matth. 4. 17")', () => {
    // read as the chapter alone, the verse would be lost without a word
    const text = 'Ut dicit Dominus, Matth. 4. 17 quod verum est.';
    expect(toEn(text)[0]).toMatchObject({ source: 'Matth. 4', canonical: ['Matt 4'] });
    const unparsed = findUnparsedFragments(text, 'la');
    expect(unparsed).toHaveLength(1);
    expect(unparsed[0]?.text.startsWith('17')).toBe(true);
    // the next citation after a sentence is not a leftover, and nor is a period with no number
    expect(findUnparsedFragments('Matth. 4, 17. 1 Cor. 15, 22 et alia.', 'la')).toEqual([]);
    expect(findUnparsedFragments('Matth. IV. Hoc dixit.', 'la')).toEqual([]);
    expect(findUnparsedFragments('Matth. 4, 17. Hoc dixit.', 'la')).toEqual([]);
  });

  it('reports a citation with white space before its period ("Matth . IV , 17")', () => {
    for (const text of [
      'Ut dicit Dominus, Matth . IV , 17 quod verum est.',
      'Ut dicit Dominus, Matth . 4 , 17 quod verum est.',
      'Ut dicit Dominus, Rom . v. 12 quod verum est.',
    ]) {
      const unparsed = findUnparsedFragments(text, 'la');
      expect(unparsed, text).toHaveLength(1);
      expect(unparsed[0]?.text, text).toMatch(/^(Matth|Rom) \. /);
    }
    // no part of the first two is a reference
    expect(toEn('Ut dicit Dominus, Matth . IV , 17 quod verum est.')).toEqual([]);
    expect(toEn('Ut dicit Dominus, Matth . 4 , 17 quod verum est.')).toEqual([]);
    // white space around the comma of a well-formed citation is still read
    expect(one('Matth. IV , 17').canonical).toEqual(['Matt 4:17']);
  });

  it('has no list for sources in other languages, Greek included', () => {
    expect(findUnparsedFragments('Matt. iv. 17, vs. 3, xviii. 36', 'grc')).toEqual([]);
    expect(findUnparsedFragments('Matt. iv. 17, vs. 3', 'de')).toEqual([]);
    expect(parseReferences('Matt. iv. 17', { source: 'grc', target: 'en' })).toEqual([]);
  });
});
