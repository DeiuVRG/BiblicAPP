# Source: Augustine, *De spiritu et littera* (412)

Recorded 2026-11-05 for the fixtures of P1-C2 (`packages/content-tools/src/translation/fixtures/`).
The full source edition (cleaning of the OCR, `edition-la.json`) is task P1-C3; this directory
holds only what the fixtures were made from.

| Item | Value |
| --- | --- |
| Work | Augustine of Hippo (354-430), *De spiritu et littera*, 412 |
| Inventory entry | `content/INVENTORY.md`, P2D-02 (OCR quality 4, text layer present) |
| Volume | *St. Augustine, De spiritu et littera, with an introduction by William Bright*, Oxford, Clarendon Press, 1914. The Latin text is reprinted from W. Bright, *Select Anti-Pelagian Treatises of St. Augustine* (Oxford, 1880), with some variant readings added from the Vienna CSEL. Scan: Cornell University Library, barcode 31924029218629 (HathiTrust page text). |
| Where the file came from | the owner's set of sources, read on the machine of the session at `/home/user/incoming/part2/Part 2/De spiritu et littera _ St_ Augustine ; with an introduction ... Anna’s Archive/31924029218629/` (a directory of 112 page-text files, not a PDF, so `pdftotext` was not needed). No download from the web was made for this source. |
| URL | none recorded by the owner's set; HathiTrust, Cornell copy (not checked from the session). |
| Page used | `00000029.txt`, printed page 23: chapter I (section 1) |
| Raw copy | `page-023.raw.txt` (plain text, read only, never executed) |
| sha256 of `page-023.raw.txt` | `26de3940339a93e919f828fd4c632c720c1fd54bc8872c9e3cdcdda148d5cd4a` |
| Licence | The Latin text of Augustine (d. 430) and the 1914 edition (William Bright died in 1901) are in the public domain. The project's rule is stricter: only the Latin of the author is the source; the editor's introduction, the English chapter headings and summaries, the footnotes (variant readings), the marginal references and the running heads are excluded. |

## What the fixture takes from the page

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
the references of the page are all in the margin, so the fixture has no scripture reference.

## Measurements recorded for the length bands

The 19th-century English translation of section 1 (D. Nutt, 1887, volume of the inventory,
P2D-12, reference for measurement only) has 1,749 characters: ratio 1.278. See
`docs/traducere-pipeline.md`, section 4.2.
