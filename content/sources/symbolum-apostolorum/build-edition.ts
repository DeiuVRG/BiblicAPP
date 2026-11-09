/**
 * Builds content/works/symbolum-apostolorum/edition-la.json (P1-C4) from the verbatim excerpt of
 * the CCEL ThML file kept next to this script. Run from the repository root:
 *
 *   node_modules/.bin/tsx content/sources/symbolum-apostolorum/build-edition.ts
 *
 * The record of the source, the correction and the division is SOURCE.md. The steps are in
 * ../_lib/source-edition.ts. Running the script again changes nothing: ids are kept.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSourceEdition } from '../_lib/source-edition';
import type { Correction, TranslationMetaTemplate } from '../_lib/source-edition';

const here = path.dirname(fileURLToPath(import.meta.url));
const SLUG = 'symbolum-apostolorum';

/** The only change to the Latin of Schaff (SOURCE.md, "Corrections"). */
const CORRECTIONS: readonly Correction[] = [
  {
    from: 'inde venturus (est) judicare',
    to: 'inde venturus est judicare',
    why: 'Schaff prints est in parentheses (not in every copy); the word is kept, the parentheses are an editor’s sign',
  },
];

/**
 * The twelve articles of the Roman Catechism (1566): the first words of each. The text between two
 * starts is one article, with the punctuation of Schaff.
 */
const ARTICLE_STARTS: readonly string[] = [
  'Credo in Deum Patrem',
  'Et in Jesum Christum',
  'qui conceptus est',
  'passus sub Pontio Pilato',
  'descendit ad inferna',
  'ascendit ad cælos',
  'inde venturus',
  'Credo in Spiritum Sanctum',
  'sanctam ecclesiam',
  'remissionem peccatorum',
  'carnis resurrectionem',
  'vitam æternam',
];

const PIPELINE =
  'Translation pipeline v3-lite (docs/traducere-pipeline.md): draft, independent critic and revision passes on claude-sonnet-5-5 run by the project’s orchestrator; deterministic checks (translation-check) and merge (translation-merge) from packages/content-tools.';

function translations(sourceEditionId: string): Record<'en' | 'ro', TranslationMetaTemplate> {
  const source = `Translated from the Latin of the received form of the Apostles’ Creed (content/works/${SLUG}/edition-la.json, edition ${sourceEditionId}), not from any English or Romanian translation.`;
  return {
    en: {
      workTitle: 'The Apostles’ Creed',
      language: 'en',
      kind: 'translation',
      licence: {
        status: 'licensed',
        note: 'New English translation made from the Latin, AI-assisted and awaiting human review (Biblioteca creștină, 2026). The Latin source text is in the public domain. The final licence of the translation will be set by the owner before publication.',
        noteRo:
          'Traducere nouă în engleză, făcută din latină, asistată de AI și în așteptarea revizuirii umane (Biblioteca creștină, 2026). Textul-sursă latin este în domeniul public. Licența finală a traducerii va fi stabilită de proprietar înainte de publicare.',
      },
      provenance: {
        source,
        extractedBy: PIPELINE,
        notes:
          'Draft translation, not yet reviewed by a human. Open findings: translation-en/review.md.',
        kind: 'ai',
        sourceLanguage: 'la',
      },
    },
    ro: {
      workTitle: 'Simbolul Apostolilor',
      language: 'ro',
      kind: 'translation',
      licence: {
        status: 'licensed',
        note: 'Traducere nouă în română, făcută din latină, asistată de AI și în curs de revizuire umană (Biblioteca creștină, 2026). Textul-sursă latin este în domeniul public. Licența finală a traducerii va fi stabilită de proprietar înainte de publicare.',
        noteEn:
          'New Romanian translation made from the Latin, AI-assisted and under human review (Biblioteca creștină, 2026). The Latin source text is in the public domain. The final licence of the translation will be set by the owner before publication.',
      },
      provenance: {
        source,
        extractedBy: PIPELINE,
        notes:
          'Draft translation, not yet reviewed by a human. Open findings: translation-ro/review.md.',
        kind: 'ai',
        sourceLanguage: 'la',
      },
    },
  };
}

buildSourceEdition({
  repoRoot: path.resolve(here, '../../..'),
  slug: SLUG,
  editionFile: 'edition-la.json',
  language: 'la',
  thmlFile: path.join(here, 'ccel-schaff-creeds2.iv.i.i.i.forma-recepta.thml.xml'),
  column: 'latin',
  corrections: CORRECTIONS,
  articleStarts: ARTICLE_STARTS,
  translations,
});
