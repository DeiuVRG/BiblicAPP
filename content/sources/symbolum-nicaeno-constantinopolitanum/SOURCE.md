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
