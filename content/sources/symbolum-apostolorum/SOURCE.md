# Source: the Apostles' Creed (Symbolum Apostolorum), Latin

Recorded 2026-11-05 for deliverable P1-C4 of `docs/roadmap-v2.md` (the creeds shelf). The edition of
the library is `content/works/symbolum-apostolorum/edition-la.json`; `build-edition.ts` in this
directory makes it from the excerpt kept here (the steps are in `../_lib/source-edition.ts`).

| Item | Value |
| --- | --- |
| Work | The Apostles' Creed, the received Latin form (*textus receptus*); no individual author, issuing body: the Western Church |
| Edition used | Philip Schaff, *The Creeds of Christendom, with a History and Critical Notes*, vol. II, *The Greek and Latin Creeds, with Translations* (New York: Harper & Brothers, 1877; the "Sixth Edition" of the CCEL file; the scans below are the 1919 printing), section I, "Symbolum Apostolicum", (a) "Forma recepta", p. 45, the Latin column. Schaff's note 42: the text is that of the *Psalterium Graecum et Romanum* published by James Ussher (London, 1647), and it agrees with the creed of Pirminius (d. 758). |
| Downloaded | 2026-11-05, with `curl` through the session proxy, with a `User-Agent` that names the project |
| URL | `https://ccel.org/ccel/schaff/creeds2.xml` (ThML file of the Christian Classics Ethereal Library, 4,065,931 bytes). The reader page of the section, `https://ccel.org/ccel/schaff/creeds2.iv.i.i.i.html`, loads its text by script, so the ThML file is what can be read. |
| sha256 of the download | `412c952ff096d7e09a1f2d9e838e9652f0fedcbf7e8d6f3999c27e69ab69091e` (not kept in the repository, 4 MB) |
| Saved as | `ccel-schaff-creeds2.iv.i.i.i.forma-recepta.thml.xml`: bytes 331418 to 347012 of the download, the element `<div4 ... id="iv.i.i.i">` copied byte for byte, no newline added (the file is read only, never executed) |
| sha256 of the excerpt | `5c3585052804a4ebea2ccc7888983de3bc6382345c5a558d0ca3399e05b06189` |
| Print, copy 1 | Internet Archive item `bibliothecasymbo020scha` (*Bibliotheca symbolica ecclesiae universalis. The creeds of Christendom*, vol. II, New York and London: Harper & Brothers, 1919 printing). Page text: `https://archive.org/download/bibliothecasymbo020scha/bibliothecasymbo020scha_djvu.txt` (1,797,526 bytes, sha256 `c8374293893bf75749fa1f55d35d747b59cab79b16acec45b3cd3c8ee11d4e0d`, downloaded 2026-11-05) |
| Saved as | `archive-org-bibliothecasymbo020scha.p45.ocr.txt`: bytes 140078 to 140710 of that page text (the OCR of printed page 45, Latin column), verbatim |
| sha256 of the OCR excerpt | `89da582e48de40742d98fa672a826e9c44bca74684949758eba09b19254b7a46` |
| Print, copy 2 | Internet Archive item `TheCreedsOfChristendomV2` (a copy digitised by Google, same printing). Page text: `https://archive.org/download/TheCreedsOfChristendomV2/TheCreedsOfChristendomV2_djvu.txt` (1,741,485 bytes, sha256 `821843389ba2dadcdc2821a71095f1046735c5361dfcf12ed1b07006df3d02ba`, downloaded 2026-11-05). Read for the cross-check, not kept. |
| Licence | Public domain. The creed is an ancient anonymous formula; Schaff died in 1893 and the book was first published in 1877. CCEL marks its ThML `<DC.Rights>Public Domain</DC.Rights>`. Nothing of the markup, the Greek column, the English translation, the notes or the introductions of the book is used in the edition. The Wikisource text (CC BY-SA) is not used. |

## What the edition takes

Only the three Latin cells of the table of the section (the creed in three parts, as Schaff sets it
out), with the footnote markers (note 43, "See Footnote 45") and the markup removed. Not taken:
Schaff's Greek column, his English translation, notes 42 to 45 (they discuss the sources and the
clause *descendit ad inferna*), headings, introductions.

## The one correction

Applied by `build-edition.ts`, which stops if it does not match exactly once.

| CCEL (and the print, both scans) | Edition | Why |
| --- | --- | --- |
| `inde venturus (est) judicare` | `inde venturus est judicare` | Schaff prints *est* in parentheses (the word is not in every copy). The parentheses are an editor's sign; the word is kept, as in the current forms of the creed. |

## Readings of the edition (kept as printed)

- Spelling of Schaff: the ligature *æ* (`cæli`, `terræ`, `cælos`, `æternam`), *j* for *i* (`Jesum`,
  `ejus`, `judicare`), `Maria virgine` and `ecclesiam` with a small initial. In the spelling of
  today these are *caeli, terrae, caelos, aeternam, Iesum, eius, iudicare, Virgine, Ecclesiam*.
- Punctuation of Schaff: semicolons between the clauses, a full stop after *terræ*, *mortuos* and
  *æternam*; `Amen.` is part of the last article.
- `descendit ad inferna`. Schaff's note 45: other Latin copies read *ad inferos*. The translation
  profile (`content/translation/profiles/symbolum-apostolorum.md`) quotes the text with *inferos*;
  the edition keeps the printed *inferna* (changing it is one line in `build-edition.ts`, and the
  ids stay).
- Nothing was modernised or retyped: the articles joined by one space are the text of the source
  after the correction above (checked by the script).

## Division into twelve articles

The headings are the numbers 1 to 12 and every section has one paragraph. The division is the
twelve articles of the Roman Catechism (*Catechismus Romanus*, 1566); other counts of twelve exist
(the pseudo-Augustinian sermons on the creed, which give one article to each apostle, and
scholastic and Reformed counts), and the division is an editorial layer that changes nothing in the text.

| Section | Text |
| --- | --- |
| 1 | Credo in Deum Patrem omnipotentem; Creatorem cæli et terræ. |
| 2 | Et in Jesum Christum, Filium ejus unicum, Dominum nostrum; |
| 3 | qui conceptus est de Spiritu Sancto, natus ex Maria virgine; |
| 4 | passus sub Pontio Pilato, crucifixus, mortuus, et sepultus; |
| 5 | descendit ad inferna; tertia die resurrexit a mortuis; |
| 6 | ascendit ad cælos; sedet ad dexteram Dei Patris omnipotentis; |
| 7 | inde venturus est judicare vivos et mortuos. |
| 8 | Credo in Spiritum Sanctum; |
| 9 | sanctam ecclesiam catholicam; sanctorum communionem; |
| 10 | remissionem peccatorum; |
| 11 | carnis resurrectionem; |
| 12 | vitam æternam. Amen. |

76 words. Schaff's text has three sentences (article 1; articles 2 to 7; articles 8 to 12); an
article that ends in a semicolon ends there because the sentence goes on in the next one.

## Cross-checks

- **The print.** Both scans give the same page: `descendit ad inferna`, `inde venturus (est)
  judicare`, `Maria virgine`, `ecclesiam`, the same order of clauses and the same punctuation as
  CCEL. The OCR cannot show the ligature (it reads *æ* as *a*, *e* or *o*: `cali`, `coli`, `terre`,
  `celos`, `eternam`), so the ligatures rest on CCEL, which keeps them in this section.
- **Latin Wikisource.** `la.wikisource.org` has "Symbolum Apostolorum" as a redirect (revision
  10081, 2006) to "Symbolum Apostolicum". The target page could not be fetched on 2026-11-05: the
  Wikimedia API answered HTTP 429 (rate limit on the shared address of the session) to the
  requests for it and for a search. It is not used.
- **The translation profile.** The text quoted there differs from the edition in one word only
  (`inferos` / `inferna`), after folding *æ* and *j*.

## Reproducing

```bash
node_modules/.bin/tsx content/sources/symbolum-apostolorum/build-edition.ts      # from the repository root
pnpm --filter @biblioteca/content-tools cli translation-jobs content/works/symbolum-apostolorum/edition-la.json --lang en
pnpm --filter @biblioteca/content-tools cli translation-jobs content/works/symbolum-apostolorum/edition-la.json --lang ro
```

## Open points

- The owner confirms Schaff's *Forma recepta* as the source edition of the shelf (roadmap, 8.3).
- `inferna` or `inferos`; the count of the twelve articles; the spelling (as printed, or modern).
- A philologist reads the Latin before the status "Verificată" (roadmap, open need 5); the text is
  not collated with a manuscript or a critical edition.
