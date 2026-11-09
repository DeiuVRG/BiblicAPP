# Source: the Creed of Constantinople (381), Greek

Recorded 2026-11-05 for the fixtures of P1-C2. The published source edition of the creed
(P1-C4: the owner confirms the list and the source editions) is a separate decision.

| Item | Value |
| --- | --- |
| Work | The Nicene-Constantinopolitan Creed (Creed of the 150 Fathers), First Council of Constantinople, 381; no individual author |
| Downloaded | 2026-11-05, with `curl` through the session proxy, with an identifying `User-Agent` |
| URL | `https://el.wikisource.org/w/api.php?action=query&prop=revisions&rvprop=content|ids|timestamp&rvslots=main&titles=Έκθεσις των ρν' πατέρων&format=json&formatversion=2` (page 10085, "Έκθεσις των ρν' πατέρων", revision 91962 of 2017-04-21T11:28:47Z) |
| Saved as | `el-wikisource-ekthesis-ton-rn-pateron.rev91962.json` (the API response, read only, never executed) |
| sha256 | `7098f41cb14a2f712cf87771c6a347d9ef393fa8bf9b49f26e6e66cd69e5c0b8` |
| Licence | The creed is a text of the year 381: public domain. The wiki page is licensed CC BY-SA 4.0 (Wikimedia contributors); nothing of the page except the verbatim text of the creed is used, and it is used only to check the fixture, not copied into it (see below). |

## How the fixture was made

The transcription of the wiki is not good enough to be a source: it has the transcription errors
`συμπροσκυνούμνον` (for `συμπροσκυνούμενον`), `προφηῶν` (for `προφητῶν`), `ἐκκησίαν` (for
`ἐκκλησίαν`) and `ἕσται` (for `ἔσται`), writes `᾽Ιησοῦν` with a separate apostrophe, and has no
punctuation of the edition (the accent of a word before a comma is the acute, not the grave).

`packages/content-tools/src/translation/fixtures/symbolum-nicaeno-constantinopolitanum.grc.txt`
(sha256 `33fb76d2c235179f29a1cd8a8882aa9965ab969a14e53144ec1c0f1961af49f2`) is therefore the
standard text of the creed as read at Chalcedon, typed by the implementer in NFC with precomposed
polytonic letters, the elision written with U+2019, and checked against the transcription: the
175 words agree after folding case, accents and punctuation, with exactly the three misspellings
above as differences; the accents agree except for the places where the punctuation decides
between the acute and the grave. The fixture has one line per article.

Other places tried the same day: `ccel.org/ccel/schaff/creeds2.iv.iii.html` (Schaff, *Creeds of
Christendom*, 1877) answers with a page whose text is loaded by script, no Greek in the HTML;
`el.wikisource.org`, "Κανόνες Δ΄ Οικουμενικής Συνόδου", has only the Definition of Chalcedon, not
the creed.

## P1-C4: the source edition of the library

Added 2026-11-05 for deliverable P1-C4 of `docs/roadmap-v2.md` (the creeds shelf). Everything above
is the record of the fixtures of P1-C2 and is unchanged; the fixture and the Wikisource file are not
the edition (its last sentence, that the source edition is a separate decision, is answered here). The edition of the library is
`content/works/symbolum-nicaeno-constantinopolitanum/edition-grc.json`; `build-edition.ts` in this
directory makes it from the excerpt kept here (the steps are in `../_lib/source-edition.ts`).

| Item | Value |
| --- | --- |
| Work | The Creed of Constantinople (381) in the conciliar form, "We believe" (Πιστεύομεν), without the Filioque; no individual author, issuing body: the First Council of Constantinople |
| Edition used | Philip Schaff, *The Creeds of Christendom, with a History and Critical Notes*, vol. II, *The Greek and Latin Creeds, with Translations* (New York: Harper & Brothers, 1877; the "Sixth Edition" of the CCEL file; the scans below are the 1919 printing), section II, "Symbolum Nicaeno-Constantinopolitanum", (a) "Forma Recepta Ecclesiae Orientalis. A.D. 381", "The Received Text of the Greek Church", pp. 57 and 58, the Greek column. Schaff's note 1: the Greek is in the Acts of the First Council of Constantinople (Mansi, III, 565), twice in the Acts of Chalcedon (Mansi, VI, 957 and VII, 111) and in the Acts of the Third Council of Constantinople (Mansi, XI, 633); see Hahn, *Bibliothek der Symbole*, p. 111. |
| Downloaded | 2026-11-05, with `curl` through the session proxy, with a `User-Agent` that names the project |
| URL | `https://ccel.org/ccel/schaff/creeds2.xml` (ThML file of the Christian Classics Ethereal Library, 4,065,931 bytes; the reader page `https://ccel.org/ccel/schaff/creeds2.iv.i.ii.i.html` loads its text by script, the same reason as above) |
| sha256 of the download | `412c952ff096d7e09a1f2d9e838e9652f0fedcbf7e8d6f3999c27e69ab69091e` (not kept in the repository, 4 MB; the same file as for the Apostles' Creed) |
| Saved as | `ccel-schaff-creeds2.iv.i.ii.i.forma-recepta-orientalis.thml.xml`: bytes 441412 to 451963 of the download, the element `<div4 ... id="iv.i.ii.i">` copied byte for byte, no newline added (read only, never executed) |
| sha256 of the excerpt | `506c3fc947f7d74906d3c165df443784c7b7af4672fb1bf88899ce1101031215` |
| Print, copy 1 | Internet Archive item `bibliothecasymbo020scha` (*Bibliotheca symbolica ecclesiae universalis. The creeds of Christendom*, vol. II, New York and London: Harper & Brothers, 1919 printing). Page text: `https://archive.org/download/bibliothecasymbo020scha/bibliothecasymbo020scha_djvu.txt` (1,797,526 bytes, sha256 `c8374293893bf75749fa1f55d35d747b59cab79b16acec45b3cd3c8ee11d4e0d`, downloaded 2026-11-05) |
| Saved as | `archive-org-bibliothecasymbo020scha.p57-58.ocr.txt`: bytes 171419 to 175436 of that page text (the OCR of printed pages 57 and 58), verbatim |
| sha256 of the OCR excerpt | `53e1ebbff55a7c16c6667d74252516aa00e87451ef902b1d36222319da11fc4b` |
| Print, copy 2 | Internet Archive item `TheCreedsOfChristendomV2` (a copy digitised by Google, same printing). Page text: `https://archive.org/download/TheCreedsOfChristendomV2/TheCreedsOfChristendomV2_djvu.txt` (1,741,485 bytes, sha256 `821843389ba2dadcdc2821a71095f1046735c5361dfcf12ed1b07006df3d02ba`, downloaded 2026-11-05). Read for the cross-check, not kept. |
| Second transcription | `el-wikisource-ekthesis-ton-rn-pateron.rev91962.json` above (the Creed of the 150 Fathers, "Έκθεσις των ρν' πατέρων", typed by Wikisource contributors); read for the cross-check, none of it is copied. |
| Licence | Public domain. The creed is a text of the year 381; Schaff died in 1893 and the book was first published in 1877. CCEL marks its ThML `<DC.Rights>Public Domain</DC.Rights>`. Nothing of the markup, the Latin version of Dionysius Exiguus, the English translation, the notes or the introductions of the book is used in the edition. The Wikisource page (CC BY-SA 4.0) is not copied. |

### What the edition takes

The Greek of the four cells of the two tables of the section (the page break splits the creed in
two tables), with the footnote markers and the markup removed. The punctuation that CCEL prints
outside the Greek spans (commas after a footnote marker) is part of the cell. Not taken: the Latin
version of Dionysius Exiguus, the English translation, notes 56 to 58 (sources, the three readings of
Mansi, Hort's note), headings, introductions.

### The ten corrections

Applied by `build-edition.ts`, which stops if one does not match exactly once. The columns "print"
give what the OCR of the two scans shows (copy 1 is kept in `archive-org-bibliothecasymbo020scha.p57-58.ocr.txt`);
the OCR is rough (it reads *ἕ* as `E`, *θ* as `S`) but shows the letters of the words that differ.

| # | CCEL | Edition | Print | The other copies |
| --- | --- | --- | --- | --- |
| 1 | `εἰς ἕν ΘΕΟΝ ΠΑΤΕΡΑ` | `εἰς ἕνα θεὸν πατέρα` | `Πιστεύομεν εἰς Eva ΘΕΟΝ TIATE-` (copy 1); `Πιστεύομεν cig ἕνα ΘΕΟΝ TIATE-` (copy 2). *ἕνα* is in the print; ΘΕΟΝ ΠΑΤΕΡΑ are small capitals. | Wikisource and the fixture: `ἕνα θεὸν πατέρα` / `ἕνα Θεὸν Πατέρα` |
| 2 | `ἸΗΣΟΥΝ ΧΡΙΣΤΟΝ,` | `Ἰησοῦν Χριστόν,` | small capitals `ἸΗΣΟΥ͂Ν ΧΡΙΣΤΟΝ,` in both | `Ἰησοῦν Χριστὸν` (no comma there) |
| 3 | `ἀληθενοῦ` | `ἀληθινοῦ` | `adnSivov` (copy 1), `ἀληϑινοῦ` (copy 2): ι, not ε | `ἀληθινοῦ` |
| 4 | `δἰ οὗ` | `δι’ οὗ` | `δι’ οὗ` (copy 2); the apostrophe, not a breathing on the iota | `δι᾽ οὗ` |
| 5 | `δἰ ἡμᾶς` | `δι’ ἡμᾶς` | the same | `δι᾽ ἡμᾶς` |
| 6 | `ΠΝΕΥΜΑ ΤΟ ἍΓΙΟΝ` | `πνεῦμα τὸ ἅγιον` | small capitals `ΠΝΕΥ͂ΜΑ TO "ATIT-ON` (copy 1) | `πνεῦμα τὸ ἅγιον` |
| 7 | `τὸ κύριον, (καὶ) τὸ ζωοποιόν ,` | `τὸ κύριον καὶ ζωοποιόν,` | `τὸ κύριον, (καὶ) τὸ ζωοποιόν,` + note: Mansi's three readings (below) | `τὸ κύριον καὶ ζωοποιόν,` |
| 8 | `ὑιῷ συν προσκυνούμενον` | `υἱῷ συμπροσκυνούμενον` | `ὑιῷ συν προσκυνούμενον` in both scans: misprints of the print | `υἱῷ συμπροσκυνούμνον` (misspelt there) |
| 9 | `βάρτισμα` | `βάπτισμα` | `βάπτισμα` (both) | `βάπτισμα` |
| 10 | `αἰώνος. Ἀμὴν.` | `αἰῶνος. Ἀμήν.` | `aiw-` / `νος. ᾿Αμήν.` (copy 1; copy 2 the same): the accent of the *ω* is not legible, the *η* of Ἀμήν has the acute | `αἰῶνος` |

On 1, 2 and 6: the print sets the words that name the three Persons in small capitals; the edition
writes them as the words they are, with the accents that capitals do not carry (*θεὸν* before
*πατέρα*, *Χριστόν* before a comma, *πνεῦμα τὸ ἅγιον*). On 7: Schaff's note says "Mansi gives three
readings: τὸ κυρ. τὸ ζωοπ.; τὸ κυρ. καὶ ζωοπ.; τὸ κυρ. καὶ τὸ ζωοπ." and refers to Hort; his text
puts the first and the third in one line with *καὶ* in parentheses. The edition takes the second,
which is also the reading of the Wikisource copy, of the Latin of Dionysius printed beside it
(*Dominum et vivificantem*) and of the fixture. On 10: the circumflex of the genitive of *αἰών*.

### Readings of the edition (kept as printed)

- Capitals only where Schaff has them (the first word of a sentence, *Ἰησοῦν Χριστόν*, *Μαρίας*,
  *Ποντίου Πιλάτου*, *Ἀμήν*): `θεοῦ`, `πατρός`, `υἱὸν`, `πνεύματος ἁγίου`, `παρθένου`, `γραφάς`,
  `ἐκκλησίαν` are in lower case. The capitals of the divine names in modern Orthodox books are a
  convention of the books, not of the text; the fixture of P1-C2 has them.
- `καθεζόμενον ἐκ δεξιῶν τοῦ πατρός`, as in the received text of the Greek Church; the Wikisource
  copy and the fixture read `ἐν δεξιᾷ`. This is the only difference of wording between the edition
  and the fixture (the fixture was typed and checked against the Wikisource copy and is not a
  witness of Schaff's text).
- `ὁμολογοῦμεν ἓν βάπτισμα` with the grave on *ἓν*, as before a following word; the OCR cannot show
  which accent the print has.
- Punctuation of Schaff: a raised dot (U+00B7) after `πατρί`, `ἐγένετο`, `νεκρούς`, `προφητῶν`,
  `ἐκκλησίαν`, `ἁμαρτιῶν`; commas elsewhere; a full stop after `ἀοράτων`, `τέλος` and `Ἀμήν`.
- The elision (`δι’`) is U+2019, as in the fixtures; NFC; no other change. The articles joined by
  one space are the text of the source after the ten corrections (checked by the script).

### Division into twelve articles

The headings are the numbers 1 to 12 and every section has one paragraph. The division is the one
of Orthodox catechesis: the Longer Catechism of the Orthodox, Catholic, Eastern Church (Philaret,
Moscow, 1830, questions 74 and 75, printed by Schaff in the same volume) counts twelve articles of
the Creed and says what each speaks of: God the Father as creator (1), the Son (2), the
incarnation (3), the suffering and death (4), the resurrection (5), the ascension (6), the second
coming (7), the Holy Spirit (8), the Church (9), baptism (10), the resurrection of the dead (11),
the life everlasting (12). It is an editorial layer and changes nothing in the text. 175 words.

| Section | Text |
| --- | --- |
| 1 | Πιστεύομεν εἰς ἕνα θεὸν πατέρα παντοκράτορα, ποιητὴν οὐρανοῦ καὶ γῆς, ὁρατῶν τε πάντων καὶ ἀοράτων. |
| 2 | Καὶ εἰς ἕνα κύριον Ἰησοῦν Χριστόν, … ὁμοούσιον τῷ πατρί· δι’ οὗ τὰ πάντα ἐγένετο· |
| 3 | τὸν δι’ ἡμᾶς τοὺς ἀνθρώπους … καὶ ἐνανθρωπήσαντα, |
| 4 | σταυρωθέντα τε ὑπὲρ ἡμῶν ἐπὶ Ποντίου Πιλάτου, καὶ παθόντα καὶ ταφέντα, |
| 5 | καὶ ἀναστάντα τῇ τρίτῃ ἡμέρᾳ κατὰ τὰς γραφάς, |
| 6 | καὶ ἀνελθόντα εἰς τοὺς οὐρανούς, καὶ καθεζόμενον ἐκ δεξιῶν τοῦ πατρός, |
| 7 | καὶ πάλιν ἐρχόμενον μετὰ δόξης κρῖναι ζῶντας καὶ νεκρούς· οὗ τῆς βασιλείας οὐκ ἔσται τέλος. |
| 8 | Καὶ εἰς τὸ πνεῦμα τὸ ἅγιον, τὸ κύριον καὶ ζωοποιόν, … τὸ λαλῆσαν διὰ τῶν προφητῶν· |
| 9 | εἰς μίαν, ἁγίαν, καθολικὴν καὶ ἀποστολικὴν ἐκκλησίαν· |
| 10 | ὁμολογοῦμεν ἓν βάπτισμα εἰς ἄφεσιν ἁμαρτιῶν· |
| 11 | προσδοκῶμεν ἀνάστασιν νεκρῶν, |
| 12 | καὶ ζωὴν τοῦ μέλλοντος αἰῶνος. Ἀμήν. |

(Articles 2, 3 and 8 are shortened here with "…"; the whole text is in the edition.)

### Cross-checks

- **The print.** Both scans give the same text as CCEL except in the places of the table above.
  By kind, the ten corrections are: keying errors of CCEL that the print shows (1 `ἕν`, 3, 9, 10
  `Ἀμὴν`, and the space before the comma in 7); the elision keyed as a breathing (4, 5); small
  capitals of the print (1, 2, 6); misprints of the print itself, repeated in CCEL (8, and `αἰώνος`
  in 10); one variant reading chosen (7).
- **The fixture** (`fixtures/symbolum-nicaeno-constantinopolitanum.grc.txt`, typed in P1-C2 and checked
  against the Wikisource copy): the 175 words of the edition equal those of the fixture, accents included
  (case and punctuation set aside), except `ἐκ δεξιῶν` / `ἐν δεξιᾷ`. The two were made from
  different sources, so the agreement is a check of both.
- **The Wikisource copy** (revision 91962): 175 words against 175; the differences are its four
  misspellings (`συμπροσκυνούμνον`, `προφηῶν`, `ἐκκησίαν`, `ἕσται`), the accents that follow its
  different punctuation (`χριστὸν`, `γραφὰς`, `πατρὸς`) and `ποιητήν` for `ποιητὴν`, a separate
  apostrophe in `᾽Ιησοῦν`, and `ἐν δεξιᾷ`.
- **Not done:** no collation with Mansi, Hahn, Schwartz's *Acta conciliorum oecumenicorum* or a
  manuscript; no reading by a philologist.

### Reproducing

```bash
node_modules/.bin/tsx content/sources/symbolum-nicaeno-constantinopolitanum/build-edition.ts      # from the repository root
pnpm --filter @biblioteca/content-tools cli translation-jobs content/works/symbolum-nicaeno-constantinopolitanum/edition-grc.json --lang en
pnpm --filter @biblioteca/content-tools cli translation-jobs content/works/symbolum-nicaeno-constantinopolitanum/edition-grc.json --lang ro
```

### Open points

- The owner confirms Schaff's "Received Text of the Greek Church" as the source edition of the
  shelf (roadmap, 8.3), with `ἐκ δεξιῶν` and the reading `τὸ κύριον καὶ ζωοποιόν`.
- The capitals of the divine names (as printed, or as in modern Orthodox books) and the count of
  the twelve articles.
- A philologist reads the Greek before the status "Verificată" (roadmap, open need 5).
