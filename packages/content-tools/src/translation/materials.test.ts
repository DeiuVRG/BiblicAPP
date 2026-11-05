import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { defined } from '../lib/invariant';
import { loadCalques, loadGlossary, ruleApplies } from './glossary';
import type { GlossaryRule } from './glossary';
import { AUGUSTINE_SLUG, CREED_SLUG } from './fixtures';

/**
 * The committed materials of the pipeline (content/translation) and the records of the sources of
 * the fixtures (content/sources): they exist, they load with the real parsers, the English ones
 * have what P1-C2 asks for, and the checksums recorded in SOURCE.md are the checksums of the files.
 */

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const MATERIALS = path.join(ROOT, 'content/translation');
const SOURCES = path.join(ROOT, 'content/sources');
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');
const sha256 = (file: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const placeholders = (text: string): string[] =>
  [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) ?? [])].sort();

describe.each(['ro', 'en'] as const)('materials of the target language %s', (lang) => {
  it('has the rules, the glossary, the calques and the three prompts', () => {
    for (const name of [
      `rules-${lang}.md`,
      `glossary-${lang}.csv`,
      `calques-${lang}.json`,
      `prompts/${lang}/draft.md`,
      `prompts/${lang}/critic.md`,
      `prompts/${lang}/revise.md`,
    ]) {
      expect(fs.existsSync(path.join(MATERIALS, name)), name).toBe(true);
    }
  });

  it('has a glossary and a list of calques that load with the real parsers', () => {
    const glossary = loadGlossary(path.join(MATERIALS, `glossary-${lang}.csv`));
    const calques = loadCalques(path.join(MATERIALS, `calques-${lang}.json`));
    expect(glossary.length).toBeGreaterThan(15);
    expect(calques.length).toBeGreaterThan(15);
    expect(new Set(glossary.map((r) => r.termId)).size).toBe(glossary.length);
    expect(new Set(calques.map((c) => c.id)).size).toBe(calques.length);
  });

  it('has prompt templates with the placeholders of the Romanian ones', () => {
    for (const name of ['draft', 'critic', 'revise']) {
      const ro = read(MATERIALS, 'prompts/ro', `${name}.md`);
      const here = read(MATERIALS, 'prompts', lang, `${name}.md`);
      expect(placeholders(here), `${lang}/${name}`).toEqual(placeholders(ro));
      expect(placeholders(here).length).toBeGreaterThan(5);
    }
  });
});

describe('the English materials', () => {
  const rules = read(MATERIALS, 'rules-en.md');
  const glossary = loadGlossary(path.join(MATERIALS, 'glossary-en.csv'));
  const calques = loadCalques(path.join(MATERIALS, 'calques-en.json'));
  const row = (id: string): GlossaryRule =>
    defined(
      glossary.find((r) => r.termId === id),
      id,
    );

  it('rules-en.md states the editorial rules of an academic translation from Latin and Greek', () => {
    for (const needle of [
      'fidelity to the original',
      'modern scholarly English',
      'No archaisms',
      'quote-author-rendering',
      '`Matt. 4:17; Mark 1:15; Luke 4:43`',
      '“…”',
      '‘…’',
      'en dash',
      '`1 Cor. 15:23–28`',
      'established English form',
      'copied exactly',
      'NFC',
      'headingEn',
      'Vulgate numbering',
      'Do not renumber',
      'SURSA_POSIBIL_ERONATA',
      'The critic',
    ]) {
      expect(rules, needle).toContain(needle);
    }
    expect(rules).toMatch(/Never\*\* straight marks/);
  });

  it('rules-en.md has the same ten sections as rules-ro.md, in the same order', () => {
    const headings = (text: string) => [...text.matchAll(/^## (\d+)\. /gm)].map((m) => m[1]);
    expect(headings(rules)).toEqual(headings(read(MATERIALS, 'rules-ro.md')));
    expect(headings(rules)).toHaveLength(10);
  });

  it('the English prompts use the English heading field and the sections of rules-en.md', () => {
    for (const name of ['draft', 'revise']) {
      const text = read(MATERIALS, 'prompts/en', `${name}.md`);
      expect(text, name).toContain('`headingEn`');
      expect(text, name).toContain('rules §4');
      expect(text, name).not.toMatch(/diacritice|română/);
    }
    expect(read(MATERIALS, 'prompts/en/critic.md')).toContain('§9');
  });

  it('every row of the glossary is PROPUS and none needs a tradition', () => {
    expect(glossary.every((r) => r.status === 'PROPUS')).toBe(true);
    expect(glossary.every((r) => r.tradition === 'all' && r.scope === 'all')).toBe(true);
  });

  it('has the generic rows of the specification', () => {
    const ids = glossary.map((r) => r.termId);
    for (const id of [
      'gratia',
      'iustitia',
      'lex',
      'spiritus',
      'littera',
      'fides',
      'caritas',
      'peccatum',
      'liberum-arbitrium',
      'praedestinatio',
      'sacramentum',
      'ecclesia',
      'episcopus',
      'homoousios',
      'hypostasis',
      'ousia',
      'theotokos',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('renders the key terms as the specification says', () => {
    const cases: [string, string, string][] = [
      ['gratia', 'gratia Dei', 'the grace of God'],
      ['iustitia', 'perfectione justitiae hominis', 'the perfection of human righteousness'],
      ['iustitia', 'iustitia Dei', 'the justice of God'],
      ['lex', 'lex bona est', 'the law is good'],
      ['spiritus', 'Spiritus vivificat', 'the Spirit gives life'],
      ['littera', 'littera occidit', 'the letter kills'],
      ['fides', 'per fidem', 'through faith'],
      ['caritas', 'charitas Dei', 'the love of God'],
      ['caritas', 'caritas Dei', 'the charity of God'],
      ['peccatum', 'sine peccato', 'without sin'],
      ['liberum-arbitrium', 'libero arbitrio', 'free will'],
      ['praedestinatio', 'praedestinatio sanctorum', 'the predestination of the saints'],
      ['sacramentum', 'sacramentum fidei', 'the sacrament of faith'],
      ['ecclesia', 'in ecclesia', 'in the Church'],
      ['episcopus', 'episcopo Hipponensi', 'the bishop of Hippo'],
      ['homoousios', 'ὁμοούσιον τῷ Πατρί', 'of one substance with the Father'],
      ['homoousios', 'consubstantialem Patri', 'consubstantial with the Father'],
      ['hypostasis', 'τρεῖς ὑποστάσεις', 'three hypostases'],
      ['ousia', 'μία οὐσία', 'one essence'],
      ['theotokos', 'Θεοτόκος', 'the Mother of God'],
    ];
    for (const [id, source, target] of cases) {
      const rule = row(id);
      expect(rule.source?.test(source), `${id} source ${source}`).toBe(true);
      expect(rule.target.test(target), `${id} target ${target}`).toBe(true);
    }
  });

  it('does not take thanks, a verb of reading or an adjective for the terms', () => {
    expect(row('gratia').source?.test('gratias agimus Deo')).toBe(false);
    expect(row('gratia').source?.test('gratis datur')).toBe(false);
    expect(row('liberum-arbitrium').target.test('free choice')).toBe(false);
    expect(row('homoousios').target.test('of like substance')).toBe(false);
    expect(row('spiritus-sanctus').target.test('Holy Ghost')).toBe(false);
  });

  it('peccatum is satisfied by the word sin and its family, not by words that begin with it', () => {
    // a FIX row exists to report a translation that lacks the rendering: `\bsin\w*` was satisfied
    // by "since", which nearly every paragraph has, so the row could never report anything
    const target = row('peccatum').target;
    for (const absent of [
      'since then',
      'a single transgression',
      'sincere faith',
      'the sinews of the body',
      'Since the time of Adam, singular grace',
      'sinecure',
    ]) {
      expect(target.test(absent), absent).toBe(false);
    }
    for (const present of [
      'without sin',
      'Sin',
      'sins',
      'a sinner',
      'sinners',
      'sinful flesh',
      'sinfully',
      'sinlessness',
      'he sinned',
      'the sinning',
      'forgive us our trespasses',
    ]) {
      expect(target.test(present), present).toBe(true);
    }
  });

  it('forbids archaisms and "Holy Ghost" everywhere, with no source pattern', () => {
    for (const id of ['holy-ghost-forbid', 'no-archaisms']) {
      expect(row(id)).toMatchObject({ force: 'FORBID', source: null });
    }
    expect(row('no-archaisms').target.test('Thou shalt not, verily')).toBe(true);
    expect(row('no-archaisms').target.test('Without thought, with the youth')).toBe(false);
  });

  it('has the calques of specification, all WARN', () => {
    expect(calques.every((c) => c.level === 'WARN')).toBe(true);
    const flagged = (text: string) => calques.filter((c) => c.pattern.test(text)).map((c) => c.id);
    expect(flagged('It is so in the same manner as before.')).toEqual(['in-the-same-manner-as']);
    expect(flagged('It is so in the same way as before.')).toEqual([]);
    expect(flagged('We speak according to that which he said.')).toEqual([
      'according-to-that-which',
    ]);
    expect(flagged('We speak according to what he said.')).toEqual([]);
    expect(flagged('Having been loved by him and having been taught by them, he left.')).toEqual([
      'passive-participles',
    ]);
    expect(flagged('Having been loved by him, he left.')).toEqual([]);
    expect(flagged('Which things he did. Whom he loved.')).toEqual(['relative-connection']);
    expect(flagged('He did this, which he loved.')).toEqual([]);
    expect(flagged('For indeed he knew; but moreover he said so.')).toEqual([
      'for-indeed',
      'but-moreover',
    ]);
  });
});

describe('the Romanian rows for Latin and Greek terms', () => {
  const glossary = loadGlossary(path.join(MATERIALS, 'glossary-ro.csv'));
  const english = loadGlossary(path.join(MATERIALS, 'glossary-en.csv'));
  const latinRows = glossary.filter((r) => r.scope === AUGUSTINE_SLUG);
  const greekRows = glossary.filter((r) =>
    ['homoousios', 'hypostasis', 'ousia', 'theotokos'].includes(r.termId),
  );
  const row = (id: string): GlossaryRule =>
    defined(
      glossary.find((r) => r.termId === id),
      id,
    );

  it('has the terms of the profile of Augustine and of the Creed, all PROPUS', () => {
    const ids = latinRows.map((r) => r.termId.replace(/^augustin-/, ''));
    for (const id of [
      'gratia',
      'iustitia',
      'iustificare',
      'lex',
      'spiritus',
      'spiritus-sanctus',
      'littera',
      'fides',
      'caritas',
      'peccatum',
      'liberum-arbitrium',
      'voluntas',
      'praedestinatio',
      'ecclesia',
      'episcopus',
      'trinitas',
      'baptismus',
      'mediator',
      'concupiscentia',
    ]) {
      expect(ids, id).toContain(id);
    }
    expect(greekRows).toHaveLength(4);
    expect([...latinRows, ...greekRows].every((r) => r.status === 'PROPUS')).toBe(true);
    expect(new Set(glossary.map((r) => r.termId)).size).toBe(glossary.length);
  });

  it('claims in the profiles are true: a FIX row for gratia and for homoousios in both glossaries', () => {
    const fix = (rows: GlossaryRule[], id: string) =>
      rows.find((r) => r.termId === id && r.force === 'FIX');
    expect(fix(english, 'gratia')).toBeDefined();
    expect(fix(glossary, 'augustin-gratia')).toBeDefined();
    expect(fix(english, 'homoousios')).toBeDefined();
    expect(fix(glossary, 'homoousios')).toBeDefined();
    const profile = read(MATERIALS, 'profiles', `${AUGUSTINE_SLUG}.md`);
    expect(profile).toContain('FIX in both glossaries');
    expect(read(MATERIALS, 'profiles', `${CREED_SLUG}.md`)).toContain('glossary row `homoousios`');
  });

  it('applies the Latin rows to the work of the profile only, never to Vos or another work', () => {
    for (const rule of latinRows) {
      expect(ruleApplies(rule, AUGUSTINE_SLUG, 'undivided'), rule.termId).toBe(true);
      expect(ruleApplies(rule, 'vos-1903-kingdom', 'protestant'), rule.termId).toBe(false);
      expect(ruleApplies(rule, 'symbolum-apostolorum', 'undivided'), rule.termId).toBe(false);
    }
    for (const rule of greekRows) {
      expect(ruleApplies(rule, CREED_SLUG, 'undivided'), rule.termId).toBe(true);
    }
  });

  it('matches the Greek rows in Greek script only: nothing of the English of Vos matches', () => {
    const vos = JSON.parse(read(ROOT, 'content/works/vos-1903-kingdom/edition-en.json')) as {
      paragraphs: { text: string }[];
    };
    expect(vos.paragraphs.length).toBeGreaterThan(100);
    for (const rule of greekRows) {
      expect(rule.source?.test('homoousios hypostasis ousia theotokos consubstantial')).toBe(false);
      expect(
        vos.paragraphs.filter((p) => rule.source?.test(p.text)),
        rule.termId,
      ).toEqual([]);
    }
  });

  it('renders the key terms as the profiles say', () => {
    const cases: [string, string, string][] = [
      ['augustin-gratia', 'gratia Dei', 'harul lui Dumnezeu'],
      ['augustin-iustitia', 'perfectione justitiae hominis', 'desăvârșirea dreptății omului'],
      ['augustin-iustitia', 'iustitia Dei', 'dreptatea lui Dumnezeu'],
      ['augustin-iustificare', 'iustificatio impii', 'îndreptățirea celui nelegiuit'],
      ['augustin-lex', 'lex bona est', 'legea este bună'],
      ['augustin-spiritus', 'Spiritus vivificat', 'Duhul dă viață'],
      ['augustin-spiritus-sanctus', 'Spiritus Sanctus', 'Duhul Sfânt'],
      ['augustin-littera', 'littera occidit', 'litera ucide'],
      ['augustin-fides', 'per fidem', 'prin credință'],
      ['augustin-caritas', 'charitas Dei', 'dragostea lui Dumnezeu'],
      ['augustin-peccatum', 'sine peccato', 'fără păcat'],
      ['augustin-peccatum', 'peccatores', 'păcătoșii'],
      ['augustin-liberum-arbitrium', 'libero arbitrio', 'liberul arbitru'],
      ['augustin-voluntas', 'voluntas eius', 'voința lui'],
      ['augustin-praedestinatio', 'praedestinatio sanctorum', 'predestinarea sfinților'],
      ['augustin-ecclesia', 'in ecclesia', 'în Biserică'],
      ['augustin-episcopus', 'episcopo Hipponensi', 'episcopul din Hippona'],
      ['augustin-trinitas', 'trinitas', 'Treimea'],
      ['augustin-baptismus', 'de Baptismo parvulorum', 'despre botezul pruncilor'],
      ['augustin-mediator', 'excepto uno Mediatore', 'în afară de singurul Mijlocitor'],
      ['augustin-concupiscentia', 'concupiscentiam nesciebam', 'concupiscența'],
      ['homoousios', 'ὁμοούσιον τῷ Πατρί', 'de o ființă cu Tatăl'],
      ['homoousios', 'ὁμοούσιον τῷ Πατρί', 'de-o-ființă cu Tatăl'],
      ['hypostasis', 'τρεῖς ὑποστάσεις', 'trei ipostasuri'],
      ['ousia', 'μία οὐσία', 'o singură ființă'],
      ['theotokos', 'Θεοτόκος', 'Născătoarea de Dumnezeu'],
    ];
    for (const [id, source, target] of cases) {
      const rule = row(id);
      expect(rule.source?.test(source), `${id} source ${source}`).toBe(true);
      expect(rule.target.test(target), `${id} target ${target}`).toBe(true);
    }
  });

  it('does not take thanks, a verb of reading, "Spiritul Sfânt" or a like substance for the terms', () => {
    expect(row('augustin-gratia').source?.test('gratias agimus Deo')).toBe(false);
    expect(row('augustin-gratia').source?.test('gratis datur')).toBe(false);
    expect(row('augustin-liberum-arbitrium').target.test('alegere liberă')).toBe(false);
    expect(row('augustin-spiritus-sanctus').target.test('Spiritul Sfânt')).toBe(false);
    expect(row('augustin-spiritus-sanctus-forbid')).toMatchObject({
      force: 'FORBID',
      source: null,
    });
    expect(row('augustin-spiritus-sanctus-forbid').target.test('Spiritul Sfânt')).toBe(true);
    expect(row('homoousios').target.test('de ființă asemănătoare')).toBe(false);
    // a word that merely begins like the rendering is not the rendering
    expect(row('augustin-peccatum').target.test('păcălit de literatura vremii')).toBe(false);
    expect(row('augustin-gratia').target.test('harta și harpa')).toBe(false);
  });
});

describe('the profiles', () => {
  it('has a profile for every work and creed of P1-C2, and the profile of the job is found', () => {
    for (const slug of ['vos-1903-kingdom', AUGUSTINE_SLUG, CREED_SLUG, 'symbolum-apostolorum']) {
      expect(fs.existsSync(path.join(MATERIALS, 'profiles', `${slug}.md`)), slug).toBe(true);
    }
  });

  it('the profile of Augustine names the edition, the references only for the critic, the terms', () => {
    const profile = read(MATERIALS, 'profiles', `${AUGUSTINE_SLUG}.md`);
    for (const needle of [
      'undivided',
      'Marcellinus',
      'Clarendon Press, Oxford, in 1914',
      'Only the Latin of Augustine is the source',
      'references for the critic only',
      'never copied',
      'Psalm numbers are those of the Vulgate',
      '| Latin | English | Română | Notes |',
      'liberum arbitrium',
      'quote-author-rendering',
      'Indicații pentru traducerea în română',
    ]) {
      expect(profile, needle).toContain(needle);
    }
    expect(profile).not.toMatch(/[şţŞŢ]/); // comma-below letters only
  });

  it('the profiles of the creeds name their issuing body, register and article structure', () => {
    const nicene = read(MATERIALS, 'profiles', `${CREED_SLUG}.md`);
    for (const needle of [
      'Issuing body',
      'First Council of Constantinople',
      'no individual author',
      'No Filioque',
      'three articles',
      'ὁμοούσιον',
      'GREEK_COPY',
      'Register and voice',
    ]) {
      expect(nicene, needle).toContain(needle);
    }
    const apostles = read(MATERIALS, 'profiles', 'symbolum-apostolorum.md');
    for (const needle of [
      'Issuing body',
      'no individual author',
      'textus receptus',
      'descendit ad inferos',
      'three parts',
      'Register and voice',
    ]) {
      expect(apostles, needle).toContain(needle);
    }
    expect(nicene + apostles).not.toMatch(/[şţŞŢ]/);
  });

  it('every new material is NFC and free of cedilla letters in Romanian text', () => {
    const files = [
      'rules-en.md',
      'glossary-en.csv',
      'glossary-ro.csv',
      'calques-en.json',
      'prompts/en/draft.md',
      'prompts/en/critic.md',
      'prompts/en/revise.md',
      `profiles/${AUGUSTINE_SLUG}.md`,
      `profiles/${CREED_SLUG}.md`,
      'profiles/symbolum-apostolorum.md',
      'output-contract.md',
      'README.md',
    ];
    for (const name of files) {
      const text = read(MATERIALS, name);
      expect(text, name).toBe(text.normalize('NFC'));
      if (!name.startsWith('rules-')) expect(text, name).not.toMatch(/[şţŞŢ]/);
    }
  });
});

describe('the sources of the fixtures', () => {
  const recorded = (dir: string): string => read(SOURCES, dir, 'SOURCE.md');

  it('records the checksum of every file it describes', () => {
    const augustine = recorded(AUGUSTINE_SLUG);
    const creed = recorded(CREED_SLUG);
    const checks: [string, string, string][] = [
      [augustine, path.join(SOURCES, AUGUSTINE_SLUG, 'page-023.raw.txt'), 'page-023.raw.txt'],
      [augustine, path.join(FIXTURES, 'augustine-de-spiritu-et-littera.ch1.la.txt'), 'ch1.la.txt'],
      [
        creed,
        path.join(SOURCES, CREED_SLUG, 'el-wikisource-ekthesis-ton-rn-pateron.rev91962.json'),
        'wikisource json',
      ],
      [creed, path.join(FIXTURES, 'symbolum-nicaeno-constantinopolitanum.grc.txt'), 'grc.txt'],
    ];
    for (const [document, file, label] of checks) {
      expect(document, label).toContain(sha256(file));
    }
  });

  it('records the date, the licence and where the text came from', () => {
    for (const dir of [AUGUSTINE_SLUG, CREED_SLUG]) {
      const text = recorded(dir);
      expect(text, dir).toContain('2026-11-05');
      expect(text, dir).toMatch(/\| Licence \|/);
      expect(text, dir).toMatch(/public domain/i);
      expect(text, dir).toMatch(/sha256/);
    }
    expect(recorded(CREED_SLUG)).toContain('https://el.wikisource.org/w/api.php');
    expect(recorded(CREED_SLUG)).toContain('revision 91962');
    expect(recorded(AUGUSTINE_SLUG)).toContain('P2D-02');
  });

  it('the Greek fixture is in NFC, and the three misspellings of the transcription are not in it', () => {
    const greek = fs.readFileSync(
      path.join(FIXTURES, 'symbolum-nicaeno-constantinopolitanum.grc.txt'),
      'utf8',
    );
    expect(greek).toBe(greek.normalize('NFC'));
    for (const wrong of ['συμπροσκυνούμνον', 'προφηῶν', 'ἐκκησίαν', 'ἕσται']) {
      expect(greek, wrong).not.toContain(wrong);
    }
    for (const right of ['συμπροσκυνούμενον', 'προφητῶν', 'Ἐκκλησίαν', 'ἔσται', 'ὁμοούσιον']) {
      expect(greek, right).toContain(right);
    }
    expect(greek.split('\n').filter(Boolean)).toHaveLength(3);
  });
});
