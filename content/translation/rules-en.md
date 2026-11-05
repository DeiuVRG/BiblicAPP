# Editorial rules for the library's translations (English)

Version 0.1 (November 2026). These rules apply to all English translations in the library's
app, whatever the source language (Latin, Greek, German, French, Spanish, Italian, Dutch).
Rules specific to a work are in `profiles/<slug>.md` and take precedence over these when they
say so explicitly. The glossary (`glossary-en.csv`) and the list of calques (`calques-en.json`)
are also read by the automatic checks; this file holds only the principles.

The basic doctrine is taken, with the owner's agreement to reuse the principles, from the
GP_AI_Translate skill (Kenneth E. Bailey, "Poet and Peasant"): the original governs meaning, the
approved rules govern style, and any change of meaning is an error, even if the English
sentence is elegant.

Every work of the library is read in Romanian and in English. For a Latin or Greek original there
are two translations, one into each language, each made **from the original** (never one from
the other). A public-domain English translation (for example the Nicene and Post-Nicene Fathers)
may be given to the critic as a reference. It is never copied, never paraphrased, and never the
text from which the translation is made.

## 1. Order of priorities

1. fidelity to the original's meaning;
2. modern scholarly English that is natural and publishable, reading as if it had been written
   in English;
3. terminological consistency (glossary and the profile of the work);
4. grammar and spelling (American spelling, as in the Chicago Manual of Style: *honor*,
   *realize*, *center*; the serial comma);
5. punctuation and typography.

A more elegant wording may not simplify, soften, sharpen or complete the author's idea. Do not
add explanations, do not omit clauses, do not draw new conclusions.

## 2. Unit of work and alignment

- One source paragraph becomes exactly one target paragraph, with the same `sourceId`. Do not
  merge, split or reorder paragraphs. If a split seems necessary, translate the paragraph as one
  and add a `DE_VERIFICAT` (MINOR) flag with the proposal.
- Section headings are translated (field `headingEn` in part 0 of the section; `headingRo` is the
  field of a Romanian translation and is not used here) and keep the numbering of the original
  (for example "Chapter I" for "Caput I").
- A paragraph's text is one paragraph, with no line breaks, in Unicode NFC. Greek is written with
  precomposed polytonic letters (NFC), never with a transliteration.

## 3. Pre-analysis before translating

For each paragraph, before writing the English, identify:

- causal, logical, temporal and conditional relations (Latin: `enim`, `autem`, `igitur`,
  `quippe`, `itaque`, `ergo`, `quamvis`, `quia`, `ut` + subjunctive; Greek: `γάρ`, `δέ`, `οὖν`,
  `ὅτι`, `ἵνα`, `ὥστε`);
- negations, quantifiers and modality (`forsitan`, `fortasse`, `videtur`, `puto`, `credo`,
  `oportet`, `debet`, `potest`; Greek `ἄν`, `δεῖ`, the optative and the subjunctive);
- the subject of each verb, pronoun references, agency (who acts, who receives, what is the
  means and what the object); the case of the nouns, the voice of the verbs, the ablative
  absolute and the participial constructions;
- theological and technical terms, words from other ancient languages, plays on words;
- scripture: what is quoted, what is the author's paraphrase, what is an allusion.

## 4. Translation

- Translate the whole sense, not the word order of the original. Reorder the constituents when
  English requires it.
- Modern scholarly English: sober, fluent, precise. **No archaisms** (no *thee*, *thou*, *hath*,
  *unto*, *whosoever*, *verily*) and no register of the King James Version, also in the scripture
  that the author quotes. No Latinisms or Graecisms (see `calques-en.json`): not *in the same
  manner as* but *in the same way as*; not *according to that which* but *according to what*;
  not a chain of *having been...* participles but clauses.
- Long periodic sentences of a Latin or Greek author may be divided into two English sentences
  **within the same paragraph** when English requires it, without loss: keep the connectors
  (*for*, *but*, *therefore*, *since*) that carry the argument.
- Keep the modality and the evaluative force of the author. *forsitan* does not become "certainly"
  nor *videtur* "is".
- Keep the person and the register of the author. When the author speaks to someone ("fili
  charissime Marcelline"), keep the address: "my dearest son Marcellinus". English has one "you".
- Keep headings, lists, numbering, emphasis, quotation marks and note markers, if there are any.
- Do not modernise or "correct" the author's theology. Do not add confessional words that the
  original does not have.
- Proper names take their established English form: ancient and medieval authors (Augustine,
  Jerome, Ambrose, John Chrysostom, Thomas Aquinas, Gregory the Great, Bernard of Clairvaux),
  biblical names in the usual English form (Isaiah, Jeremiah, Paul, Peter, Moses), places (Hippo,
  Carthage, Rome, Nicaea, Constantinople, Chalcedon). Modern names stay as in the original.
- Greek and Latin words that the translation keeps (a technical term, a play on words, a word
  the author discusses) are copied exactly, character by character, in NFC, without a new
  transliteration and without "correcting" the accents. If the OCR looks damaged, add a
  `SURSA_POSIBIL_ERONATA` flag. In a Greek source the Greek is not repeated in the translation
  (the whole paragraph is translated); what is kept must be an exact copy of the source.

## 5. Scripture quotations and references

- Scripture **quoted by the author** is translated **as the author's text**, from the source
  language, faithful to his wording (ancient authors often quote from memory or from their own
  versions, for example the Old Latin of Augustine, which differs from the Vulgate). It is not
  replaced with an English Bible written from memory: the model must not produce the text of a
  verse "as it reads in the KJV, the NRSV or the ESV". Each quotation is marked in `scripture`
  with `mode: "quote-author-rendering"` and the reference, so that the app can replace it later
  with a licensed edition. Allusions are marked `allusion`, bare references `reference`.
- References are written in the **standard English notation**: abbreviated book, Arabic chapter,
  colon, verses (`Matt. 4:17; Mark 1:15; Luke 4:43`), ranges with an en dash and no spaces
  (`1 Cor. 15:23–28`), lists with a comma and a space (`John 3:3, 5`), `ff.` for the Latin
  `sq.` or `sqq.` (`Matt. 18:23 ff.`), `v.` and `vv.` for a continuation by verse. The list of
  abbreviations and the conversion from the notation of the source (roman numerals, Latin
  abbreviations, `ibid.`) are given in each job (field `references`, `target`): use exactly those
  forms. In a series the book is not repeated (`Matt. 5:12; 6:20`). Never use roman numerals for
  chapters, nor Latin abbreviations such as `Matth.`, `Marc.`, `Ioh.`, in the translation.
- **Vulgate numbering.** A Latin source numbers the psalms, and the books of Kings and Esdras, as
  the Vulgate does. Do not renumber: `Ps. 118, 2` is `Ps. 118:2` (in the Hebrew numbering of
  most modern Bibles it is Ps. 119). Where a reference of the job has a `note`, read it. A later
  editorial layer may add the Hebrew number; the translator does not.
- If the author gives a reference that looks wrong (a verse that does not exist, a wrong chapter),
  translate it as it is and add a `SURSA_POSIBIL_ERONATA` (MAJOR) flag with the explanation. Do
  not correct it silently.

## 6. Terminology

- Apply the `FIX` rows of the glossary when the context fits; for `PREFER` and `WARN` decide in
  context and consistently throughout the work. Do not flatten distinctions that the author
  keeps between two terms (for example *gratia* and *misericordia*, *lex* and *mandatum*,
  *iustitia* and *iustificatio*, *voluntas* and *liberum arbitrium*, *amor*, *dilectio* and
  *caritas*).
- A new term that recurs and has no glossary row gets a `TERMEN_NOU` (INFO) flag with the chosen
  rendering, so that it can be added after approval. Do not modify the glossary.
- The author's technical terms are rendered consistently and, at the first occurrence, with the
  original in parentheses if the profile of the work asks for it.

## 7. Punctuation and typography

- Quotation marks: curly double marks “…” at the first level and curly single marks ‘…’ inside
  them. The apostrophe and the closing single mark are ’ (U+2019). **Never** straight marks `"`
  or `'` in the text. Romanian „…” and French «…» are not used.
- Dashes: the en dash – for ranges (`15:23–28`, `412–413`) without spaces; the em dash — for an
  incidental break, without spaces; the hyphen only in compounds.
- Ellipsis: the single character …
- Centuries: "the fifth century" in prose.
- Capitals: God, the Father, the Son, the Holy Spirit, the Spirit (of God), the Lord, the
  Mediator, the Trinity, Scripture and the Scriptures, the Gospel and the Gospels, the Old
  Testament and the New Testament, the Law (of Moses, as a whole), the Church (the whole
  institution; "a church" for a local community or a building), baptism and the eucharist in
  lower case. Pronouns that refer to God in lower case (academic use), unless the profile says
  otherwise.
- Numbers: figures of the original stay figures; numbers written in words stay words.
- The number of a section of the original (the "§ 1" of an edition) is not part of the paragraph
  text.

## 8. Flags (what to flag, and how)

Each flag has `code`, `severity`, `note` and, whenever possible, `quoteSource` and `quoteTarget`
(exact quotations, never positions).

- `CRITIC`: you could not render the sense without loss, or an ambiguity changes the doctrine or
  the argument; the paragraph cannot be published without a person.
- `MAJOR`: a real ambiguity with two plausible readings, a reference or a quotation to verify, a
  term with theological weight and no precedent in the glossary.
- `MINOR`: a stylistic choice to review, a possible calque, an awkward wording you are not sure of.
- `INFO`: a proposed new term, a note for the reviewer.

The codes: `DE_VERIFICAT`, `SURSA_POSIBIL_ERONATA`, `TERMEN_NOU`, `CITAT_BIBLIC`, `AMBIGUITATE`,
`ALTA` (they are identifiers, the same for every language: *to be verified*, *source possibly
corrupt*, *new term*, *biblical quotation*, *ambiguity*, *other*). Do not invent checks you did not
make; never certify a translation as "publishable".

## 9. The critic's audit (a separate role)

The critic receives the original, the translation and the rules, not the translator's reasoning.
The critic checks, in both directions, sentence by sentence:

1. does every statement of the original have a counterpart in the English?
2. does every statement of the English exist in the original?
3. are negations, questions, conditionals and causal clauses kept?
4. are modality and the degree of certainty kept?
5. are the roles of the participants (agent, patient, instrument, object) kept?
6. are scripture quotations and words from the ancient languages rendered completely and exactly?
7. are names, numbers and references identical (compare with `references[].target`)?
8. do the terms follow the glossary and the profile, and are the calques of the list absent?

Severity codes: `CRITIC` (omission or addition of sense, negation, agency, a changed quotation
or reference), `MAJOR` (an ambiguity that may suggest a wrong interpretation, an inconsistent
term), `MINOR` (wording, calque, punctuation), `SURSA_POSIBIL_ERONATA`. Each finding quotes the
source and the translation exactly, states the problem and gives a concrete proposal. An empty
list with the verdict `ok` is a legitimate result; do not invent problems to fill the report.

## 10. The golden rule

First check that every meaning of the original has reached the English, and that every meaning
of the English is justified by the original. Only then optimise naturalness and style.
