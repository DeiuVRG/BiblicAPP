/**
 * Builds content/works/symbolum-nicaeno-constantinopolitanum/edition-grc.json (P1-C4) from the
 * verbatim excerpt of the CCEL ThML file kept next to this script. Run from the repository root:
 *
 *   node_modules/.bin/tsx content/sources/symbolum-nicaeno-constantinopolitanum/build-edition.ts
 *
 * The record of the source, the corrections and the division is SOURCE.md (section "P1-C4"). The
 * steps are in ../_lib/source-edition.ts. Running the script again changes nothing: ids are kept.
 *
 * The Greek of CCEL is the transcription of Schaff; SOURCE.md says, for each of the ten
 * corrections below, what the print and the other copies read. The apostrophe of the elision is
 * U+2019, as in the fixtures of packages/content-tools.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSourceEdition } from '../_lib/source-edition';
import type { Correction, TranslationMetaTemplate } from '../_lib/source-edition';

const here = path.dirname(fileURLToPath(import.meta.url));
const SLUG = 'symbolum-nicaeno-constantinopolitanum';

const CORRECTIONS: readonly Correction[] = [
  {
    from: 'εἰς ἕν ΘΕΟΝ ΠΑΤΕΡΑ παντοκράτορα',
    to: 'εἰς ἕνα θεὸν πατέρα παντοκράτορα',
    why: 'CCEL has ἕν, the print ἕνα; small capitals of the print written in lower case, with their accents',
  },
  {
    from: 'κύριον ἸΗΣΟΥΝ ΧΡΙΣΤΟΝ,',
    to: 'κύριον Ἰησοῦν Χριστόν,',
    why: 'small capitals of the print written as a name, with their accents',
  },
  {
    from: 'ἀληθενοῦ',
    to: 'ἀληθινοῦ',
    why: 'misprint of CCEL; the print has ἀληθινοῦ',
  },
  {
    from: 'δἰ οὗ',
    to: 'δι’ οὗ',
    why: 'CCEL writes the elision as an iota with a smooth breathing; the print has the apostrophe',
  },
  {
    from: 'δἰ ἡμᾶς',
    to: 'δι’ ἡμᾶς',
    why: 'the same elision',
  },
  {
    from: 'ΠΝΕΥΜΑ ΤΟ ἍΓΙΟΝ',
    to: 'πνεῦμα τὸ ἅγιον',
    why: 'small capitals of the print written in lower case, with their accents',
  },
  {
    from: 'τὸ κύριον, (καὶ) τὸ ζωοποιόν ,',
    to: 'τὸ κύριον καὶ ζωοποιόν,',
    why: 'Schaff conflates two of the three readings of Mansi in parentheses; the second reading is taken; the space before the comma is a markup artefact',
  },
  {
    from: 'ὑιῷ συν προσκυνούμενον',
    to: 'υἱῷ συμπροσκυνούμενον',
    why: 'misprints of the print (ὑιῷ for υἱῷ; a space and ν for μ in συμπροσκυνούμενον), found in both scans',
  },
  {
    from: 'βάρτισμα',
    to: 'βάπτισμα',
    why: 'misprint of CCEL; the print has βάπτισμα',
  },
  {
    from: 'αἰώνος. Ἀμὴν.',
    to: 'αἰῶνος. Ἀμήν.',
    why: 'the genitive singular of αἰών takes the circumflex; Ἀμήν has the acute in the print (CCEL: grave)',
  },
];

/** The twelve articles of the Creed: the first words of each, in order. */
const ARTICLE_STARTS: readonly string[] = [
  'Πιστεύομεν εἰς ἕνα',
  'Καὶ εἰς ἕνα κύριον',
  'τὸν δι’ ἡμᾶς',
  'σταυρωθέντα τε',
  'καὶ ἀναστάντα',
  'καὶ ἀνελθόντα',
  'καὶ πάλιν ἐρχόμενον',
  'Καὶ εἰς τὸ πνεῦμα',
  'εἰς μίαν',
  'ὁμολογοῦμεν',
  'προσδοκῶμεν',
  'καὶ ζωὴν τοῦ μέλλοντος',
];

const PIPELINE =
  'Translation pipeline v3-lite (docs/traducere-pipeline.md): draft, independent critic and revision passes on claude-sonnet-5-5 run by the project’s orchestrator; deterministic checks (translation-check) and merge (translation-merge) from packages/content-tools.';

function translations(sourceEditionId: string): Record<'en' | 'ro', TranslationMetaTemplate> {
  const source = `Translated from the Greek of the Creed of Constantinople (content/works/${SLUG}/edition-grc.json, edition ${sourceEditionId}), not from any English or Romanian translation.`;
  return {
    en: {
      workTitle: 'The Nicene-Constantinopolitan Creed',
      language: 'en',
      kind: 'translation',
      licence: {
        status: 'licensed',
        note: 'New English translation made from the Greek, AI-assisted and awaiting human review (Biblioteca creștină, 2026). The Greek source text is in the public domain. The final licence of the translation will be set by the owner before publication.',
        noteRo:
          'Traducere nouă în engleză, făcută din greacă, asistată de AI și în așteptarea revizuirii umane (Biblioteca creștină, 2026). Textul-sursă grecesc este în domeniul public. Licența finală a traducerii va fi stabilită de proprietar înainte de publicare.',
      },
      provenance: {
        source,
        extractedBy: PIPELINE,
        notes:
          'Draft translation, not yet reviewed by a human. Open findings: translation-en/review.md.',
        kind: 'ai',
        sourceLanguage: 'grc',
      },
    },
    ro: {
      workTitle: 'Simbolul niceo-constantinopolitan',
      language: 'ro',
      kind: 'translation',
      licence: {
        status: 'licensed',
        note: 'Traducere nouă în română, făcută din greacă, asistată de AI și în curs de revizuire umană (Biblioteca creștină, 2026). Textul-sursă grecesc este în domeniul public. Licența finală a traducerii va fi stabilită de proprietar înainte de publicare.',
        noteEn:
          'New Romanian translation made from the Greek, AI-assisted and under human review (Biblioteca creștină, 2026). The Greek source text is in the public domain. The final licence of the translation will be set by the owner before publication.',
      },
      provenance: {
        source,
        extractedBy: PIPELINE,
        notes:
          'Draft translation, not yet reviewed by a human. Open findings: translation-ro/review.md.',
        kind: 'ai',
        sourceLanguage: 'grc',
      },
    },
  };
}

buildSourceEdition({
  repoRoot: path.resolve(here, '../../..'),
  slug: SLUG,
  editionFile: 'edition-grc.json',
  language: 'grc',
  thmlFile: path.join(here, 'ccel-schaff-creeds2.iv.i.ii.i.forma-recepta-orientalis.thml.xml'),
  column: 'greek',
  corrections: CORRECTIONS,
  articleStarts: ARTICLE_STARTS,
  translations,
});
