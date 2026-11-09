# Source: Augustine, *De spiritu et littera* (412)

Recorded 2026-11-05. The directory was made for the fixtures of P1-C2
(`packages/content-tools/src/translation/fixtures/`) and now holds the whole source of the Latin
edition of deliverable P1-C3 (`content/works/augustine-de-spiritu-et-littera/edition-la.json`): the
raw text, the two scripts that turn it into the text that `ingest-text` reads, and the log of every
change.

| Item | Value |
| --- | --- |
| Work | Augustine of Hippo (354-430), *De spiritu et littera*, 412, addressed to Marcellinus |
| Inventory entry | `content/INVENTORY.md`, P2D-02 (OCR quality 4, text layer present) |
| Volume | *St. Augustine, De spiritu et littera, with an introduction by William Bright*, Oxford, Clarendon Press, 1914. The Latin text is reprinted from W. Bright, *Select Anti-Pelagian Treatises of St. Augustine* (Oxford, 1880), with some variant readings added from the Vienna CSEL (they stand in the footnotes, marked `V.`). Scan: Cornell University Library, barcode 31924029218629 (HathiTrust page text). |
| Where the files came from | the owner's set of sources, read on the machine of the session at `/home/user/incoming/part2/Part 2/De spiritu et littera _ St_ Augustine ; with an introduction ... Anna’s Archive/31924029218629/`: a directory of 112 page-text files (`00000001.txt` ... `00000112.txt`, dated 2023-10-05 in the set), not a PDF, so `pdftotext` was not needed. No download from the web was made for this source. |
| URL | none recorded by the owner's set; HathiTrust, Cornell copy (not checked from the session). |
| Extracted | 2026-11-05, by `extract.py` (the page files are untrusted data: read as bytes, never executed) |
| Licence | The Latin text of Augustine (d. 430) and the 1914 edition (William Bright died in 1901) are in the public domain. The project's rule is stricter: only the Latin of the author is the source; the editor's introduction, the English chapter headings and summaries, the footnotes (variant readings), the marginal references, the running heads and the appendix are excluded. |
| sha256 of `raw-layout.txt` (= `raw.txt`) | `57d01fe1d48c8978a0bfe464806ef37fc7f0f99301a936d03723d788554b958d` |
| sha256 of `clean.txt` | `b981ec776f6f71686e098fd151d0cddad52a45771ef0e7e6256b31fb741372ed` |
| sha256 of `edition-la.json` | `747153fa5ff73e9d9f5d3c3876f308fe0a6c362379cfda910e14f2b60d31900c` |
| Page used for the P1-C2 fixture | `00000029.txt`, printed page 23: chapter I (section 1) |
| Raw copy of that page | `page-023.raw.txt` (plain text, read only, never executed; it is page 29 of `raw-layout.txt`, byte for byte) |
| sha256 of `page-023.raw.txt` | `26de3940339a93e919f828fd4c632c720c1fd54bc8872c9e3cdcdda148d5cd4a` |

## The volume

The page files are in page order; raw page = printed page + 6 (`00000029.txt` is printed page 23).

| Raw pages | Printed pages | Content | In the edition |
| --- | --- | --- | --- |
| 1-8 | | cover and library pages, title pages, imprint | no |
| 9-10 | 3 | the editor's note (the text is reprinted from Bright's 1880 volume, with variant readings from the Vienna CSEL) and a blank page | no |
| 11-28 | 5-22 | William Bright's introduction, in English, with footnotes | no |
| **29-103** | **23-97** | **the treatise: 36 chapters, 66 numbered sections** | **yes** |
| 104 | 98 | Augustine, *Retractationes* ii. 37 (his own Latin note on this book), and the imprint of the printer | no (another work; it could be added later as a separate work) |
| 105-112 | | blank | no |

Printed pages of the treatise: a running head (`DE SPIRITU ET LITTERA [CHAP. XII` and the page number,
in three different orders of lines); at the start of a chapter, `CHAPTER <numeral>` and the editor's
English summary; the Latin text with the section number (`14.`) at the start of a paragraph; in the
outer margin the editor's references to Scripture and to other works of Augustine; at the foot the
footnotes (variant readings of the CSEL, ending in `V.`) and the printer's signature marks (`1709`,
`C 2`). The OCR put the margin on the same lines as the text (at the end of the lines on odd raw
pages, at the start on even ones), or on lines of their own, sometimes broken over several lines.

## Files

| File | What it is |
| --- | --- |
| `extract.py` | joins the 112 page files, byte for byte, one page per form feed, into `raw-layout.txt`; writes `raw-pages.sha256` (the sha256 of every page file). `python3 -I extract.py --pages-dir <dir>` |
| `raw-layout.txt`, `raw.txt` | the 112 pages (166830 bytes). The page texts have no layout beyond their line breaks, so the `pdftotext -layout` and plain extractions that the other works have do not differ here: the two files are byte-identical (`raw.txt` only keeps the name of the Vos sources) |
| `raw-pages.sha256` | sha256 of each of the 112 page files |
| `clean.py` | the deterministic pre-cleaning (stdlib only; `python3 -I clean.py --raw raw-layout.txt --out clean.txt --log clean.log`). Documented at the top of the file; exits 1 unless its invariants hold |
| `clean.txt` | its output: only the Latin of the treatise, 75 pages (raw pages 29-103), 36 `CHAPTER` markers, the first line of each section indented by four spaces |
| `clean.log` | one line per removed or changed item, with the raw page: 150 running-head lines, 15 signature marks, 30 footnotes, 28 footnote marks in the text, 151 + 106 marginal references cut from the end or the start of a line, 176 lines that were only a reference, 58 lines of English chapter summaries, 2 + 29 lines of scan noise, 42 exact repairs (`RAW_FIXES`, with the reason) |
| `page-023.raw.txt` | raw page 29, the source of the P1-C2 fixture (below) |

Rebuild (from the repository root; the output is byte-identical, ids included):

```bash
python3 -I content/sources/augustine-de-spiritu-et-littera/extract.py --pages-dir "<the directory of the 112 page files>"
python3 -I content/sources/augustine-de-spiritu-et-littera/clean.py \
  --raw content/sources/augustine-de-spiritu-et-littera/raw-layout.txt \
  --out content/sources/augustine-de-spiritu-et-littera/clean.txt \
  --log content/sources/augustine-de-spiritu-et-littera/clean.log
pnpm --filter @biblioteca/content-tools cli ingest-text content/sources/augustine-de-spiritu-et-littera/clean.txt \
  --work content/works/augustine-de-spiritu-et-littera/work.json --verbose
```

## What the edition is

`content/works/augustine-de-spiritu-et-littera/edition-la.json`: 36 sections (one per chapter of the
edition, headed with the chapter numeral `I` ... `XXXVI`: the 1914 edition has English summaries
only, no Latin chapter titles), 67 paragraphs, 17,553 words.

- **One paragraph per numbered section** (1-66, in order). The section numbers are not in the text
  (profile of the work: they are structure, not paragraph text); this is checked by `clean.py`
  (the numbers run 1..66 without a gap, and every section but the first follows a line that ends a
  sentence). **Chapter XXVIII begins inside section 48**, so that section is two paragraphs: the
  last of chapter XXVII (it ends with a colon: `... mereantur:`) and the first of chapter XXVIII.
  Paragraph p of the edition is section p for p <= 48 and section p - 1 for p >= 49.
- **Spelling of the edition**: `j` and `v` (*justitia*, *vivificat*), `coelum`, `foeditas`, `charitas`,
  `caeteri`. Not normalised.
- **Hyphenation** at the end of a line is resolved by `ingest-text` from the text's own usage (314
  line-end hyphens, all joined: syllable breaks; Latin has no compound written with a hyphen).
- **Quotation marks**: the edition prints single marks round the words of an opponent, an example
  or a term; the OCR read them as straight `'` and often lost the opening one. They are written
  `‘...’` and restored where the sense requires it (the 30 quotation-mark entries of `RAW_FIXES`, each
  with its reason); Scripture quoted by Augustine has no quotation marks in the edition.
- **First words**: the first word of a chapter is printed in capitals (`LECTIS`); written with an
  initial capital. A space before `;`, `:`, `?`, `!` (the print sets one) is removed.
- **Repairs of the OCR** are explicit and reviewable: `RAW_FIXES` in `clean.py` (a displaced `Quod`,
  a colon displaced after *fallitur*, `De` and `vita` of section 37, the editor's bracketed query
  on raw page 101) and `replacements` / `wordFixes` in `ingest.config.json` (`justi cabitur`,
  `filem`, `filli`, `justitius`, `sufficientiu`, `computantura`, `praecipiturquemadmodum`, `NON`,
  two stray full stops, a dotted `ė`, `cerimoniae`, and the Greek word *theosebeia* of chapter XI,
  `deoσéßetav` / `Oeoσéßeia` in the OCR).
- **Scripture references**: none. The citations of Scripture in the treatise are inline quotations
  without references; the references were in the margin and are excluded. `translation-jobs
  --verbose` reports 0 reference runs and 0 unparsed reference-like fragments, for `en` and for `ro`.

## Quality note (2026-11-05)

Not proof-read against the printed page: only the OCR text was available (no scan images). What was
done instead:

1. **The whole Latin text was read** (every paragraph, against the raw lines where something looked
   wrong). This found the repairs above, among them one real defect that no automatic check could
   see: in section 37 the OCR had left `De` out of *De hac vita dicit ipse Dominus* and put the
   last word of the line (*vita*) after the footnotes.
2. **Automatic invariants** (`clean.py`, and `src/committed-augustine.test.ts` in `content-tools`):
   36 chapters and 66 sections in order; each running head names the chapter that is current at the
   end of its page; no digits, brackets, reference abbreviations, roman numerals, English words,
   footnote readings or unresolved hyphens in the Latin; balanced quotation marks and parentheses; a
   scan of the vocabulary (words that occur once or twice, letter clusters that do not occur in
   Latin, i/j and u/v habits). Line counts per page are consistent with the printed pages: 33 lines of Latin on a page without
   footnotes, 32 on a page with them (pages that open or end a chapter are shorter; on raw page 94
   the OCR split two lines into four): no line of text was lost.
3. **A sample of ten paragraphs against the raw page text** (`random.Random(412).sample(range(67), 10)`:
   paragraphs 8, 13, 14, 20, 26, 30, 37, 61, 66 and 67, which are sections 8, 13, 14, 20, 26, 30, 37,
   60, 65 and 66, in chapters V, VIII, VIII, XII, XIV, XVII, XXII, XXXIV, XXXVI, XXXVI). Each
   paragraph was printed next to its raw lines and compared word by word (eight by a word-level
   diff after dropping only the tokens that carry a digit or a superscript, the two at the end of
   a chapter and of the book by eye): in all ten the Latin of the edition equals the raw Latin
   except for the intended differences: the removed apparatus (references, footnote lines,
   summaries, running heads), the joined hyphens, the removed spaces before `;` `:` `?`, the restored
   quotation marks, and the known repairs (`justificabitur`, `sufficientia`, `divinitus`, `De ...
   vita`). No other difference, no word lost or added.

Readings that a reader with the printed page should check (nothing below was changed unless said):

- Section 56 (chapter XXXII): *quia charitas eam facit, **quam** non libet nisi quod licet*: the
  relative would be *cui* in the usual text; the OCR reads *quam*; left as it is.
- Section 36 (chapter XXI): *quarumdam escarum **caerimoniae***. **Changed**: the OCR has
  `ceri-moniae` at the end of a line; Augustine quotes the phrase as *caerimoniae* in
  *Retractationes* ii. 37, printed on page 98 of this volume, and the margin of the line refers to it
  (`See below, p. 98.`).
- Section 54 (chapter XXXI): *Sed aliter dicimus. ‘Non mihi habuit fidem:’*: the full stop is the
  OCR's; the print may have a comma.
- Section 21 (chapter XIII): *Non concupisces de qua item dicit*, and section 49 (chapter XXVIII):
  *sed et Gentium quod quantulacumque*: the OCR shows no punctuation where the print may have a
  colon or a semicolon.
- Section 3 (chapter II): the colon after *fallitur* is the OCR's stray `:` line put back; section 22:
  *Quod* moved to the end of the line of the section number; section 37: *De* and *vita* put back.
- The 30 variant readings of the Vienna CSEL (footnotes) are not recorded: the edition is the text
  of Bright.
- The text of a printed word that the OCR may have confused with another (*i*/*j*, *u*/*v* aside,
  which are consistent) can only be found with the page image. Open: a proof-reading
  against the HathiTrust scan before publication (the edition is marked `review: needs-review`, and
  the translations are made from this text).

## The fixture of P1-C2

`fixtures/augustine-de-spiritu-et-littera.ch1.la.txt` (sha256
`391112b03510001d54663249dbc106e7ddf48c5dd36e851d7dcfd25bfddcfe39`) is the Latin of section 1:

- removed: the running head, the English heading and summary of chapter I, the section number
  `1.`, the right-margin references (`Rom. viii.`, `De Pecc.` and `7, 20.`, `1 Cor. xv. 22.`,
  `Matt. xix. 24,`, `Matt. xxvi.`, `Deut. xxxi.`, `Judg. ii. 3.`) and the leftover digits of the
  margin (`26.`, `53.`, `3.`), the footnote `1 legionum V.` and its marker after `legiones`;
- done: words broken at the end of a line joined (`similitu-dine`, `rescrip-sisti`, `exem-plum`);
  the first word, printed in capitals (`LECTIS`), written `Lectis`; NFC; one paragraph;
- kept: the spelling of the edition (`j`, `v`, `charissime`, `legiones` as printed).

210 words, 1,369 characters. The same page has no inline reference in the text of the author:
the references of the page are all in the margin, so the fixture has no scripture reference. The
edition of P1-C3 starts with the same paragraph (the text of `edition-la.json` for section 1 is
this fixture, byte for byte).

## Measurements recorded for the length bands

The 19th-century English translation of section 1 (D. Nutt, 1887, volume of the inventory,
P2D-12, reference for measurement only) has 1,749 characters: ratio 1.278. See
`docs/traducere-pipeline.md`, section 4.2.
