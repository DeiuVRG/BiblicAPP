# Fixtures of the dry runs (P1-C2)

Test data of `packages/content-tools/src/translation` (`translation-dry-run.test.ts` and the tests
of the checks). Nothing here is published: the translations are **test translations** written for
the checks, not editions of the library.

| File | What it is | Provenance |
| --- | --- | --- |
| `augustine-de-spiritu-et-littera.ch1.la.txt` | Latin of chapter I (section 1) of Augustine, *De spiritu et littera* | The 1914 Clarendon Press edition (introduction by William Bright), page 23 of the volume, HathiTrust page text `00000029.txt` of the volume in `content/INVENTORY.md` (P2D-02). The editor's English chapter heading and summary, the marginal references (`Rom. viii.`, `1 Cor. xv. 22.`, `Matt. xix. 24,`, `Matt. xxvi.`, `Deut. xxxi.`, `Judg. ii. 3.`, `De Pecc. 7, 20.`) and the footnote (`legionum V.`) with its marker are removed; words broken at the end of a line are joined; the first word, printed in capitals, is written `Lectis`. The spelling of the edition (`j`, `v`, `charissime`) is kept. Provenance of the source: `content/sources/augustine-de-spiritu-et-littera/SOURCE.md`. |
| `augustine-de-spiritu-et-littera.ch1.en.txt` | Test translation into English from the Latin | Written for this test (not copied from any published translation). |
| `augustine-de-spiritu-et-littera.ch1.ro.txt` | Test translation into Romanian from the Latin | Written for this test. |
| `symbolum-nicaeno-constantinopolitanum.grc.txt` | Greek of the Creed of Constantinople (381), one line per article, polytonic, NFC; the elision mark is U+2019 | The standard text of the creed in the form read at Chalcedon, typed and checked word by word against the transcription of Greek Wikisource (revision 91962) kept in `content/sources/symbolum-nicaeno-constantinopolitanum/`, whose own errors (`συμπροσκυνούμνον`, `προφηῶν`, `ἐκκησίαν`, `ἕσται`) it does not repeat. Not the published edition of the library. |
| `symbolum-nicaeno-constantinopolitanum.en.txt` | Test translation into English from the Greek | Written for this test. |
| `symbolum-nicaeno-constantinopolitanum.ro.txt` | Test translation into Romanian from the Greek | Written for this test. |
| `index.ts` | loads the files, builds the source editions, the jobs and the outputs | |

The text files end with a newline; one line is one paragraph.
