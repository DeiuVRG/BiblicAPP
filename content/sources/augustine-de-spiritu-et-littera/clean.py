"""Deterministic pre-cleaning of the OCR page text of Augustine, De spiritu et littera.

Input:  raw-layout.txt (extract.py: the 112 page files of the 1914 Clarendon Press volume, one page
        per form feed; page N of the file is the page file 000000NN.txt).
Output: clean.txt, the Latin text of the treatise only, in the shape that `ingest-text` expects:
        one page per form feed, `CHAPTER <numeral>` marker lines, a one-line heading block per
        chapter (the numeral), and the first line of every numbered section indented by four
        spaces (the "layout" paragraph mode of the ingest config). Hyphenation, OCR repairs of
        single words and ids are the business of ingest-text and
        content/works/augustine-de-spiritu-et-littera/ingest.config.json.
Log:    clean.log, one line per removed or changed item (what, raw page, text), so that a reviewer
        can check that nothing of Augustine's Latin was removed.

What is removed (the 1914 editor's apparatus and the scan furniture; none of it is Latin prose of
the treatise, and the editor's matter is not public-domain text of Augustine):

  * everything outside the treatise: the library pages, Bright's English introduction (raw pages
    1..28), the appendix after the treatise (raw page 104: Retractationes ii. 37, a different work)
    and the blank pages 105..112;
  * the running heads ("DE SPIRITU ET LITTERA [CHAP. XII", the page numbers) and the signature
    marks ("1709", "C 2") at the foot of a page;
  * the English chapter headings and summaries after each "CHAPTER <numeral>" line;
  * the marginal references to Scripture and to other works ("Rom. iv. 15.", "De Pecc. 7, 20.",
    "Cp. Gal. vi. 3.", "See below, p. 98."). The OCR put them at the start of the Latin lines on
    the even raw pages (left margin), at the end on the odd ones (right margin), or on lines of
    their own, sometimes broken over several lines; the digits left over are removed too;
  * the footnotes, which are variant readings of the Vienna CSEL ("1 dimicat V."), and their
    markers in the text (superscript or plain digits);
  * the editor's bracketed query on raw page 101 ("[Qu. insert Verum this before ecce, Bened.]");
  * scan noise: stray marks, and a strip of fragments at the foot of raw page 86.

What is kept: the Latin of the treatise, word for word, in the spelling of the edition; the numbered
sections (1..66 of the traditional division) as paragraph starts; the 36 chapters of the edition.
The section numbers are not part of the paragraph text (content/translation/profiles/
augustine-de-spiritu-et-littera.md): the n-th section is the n-th numbered paragraph start, and
this script verifies that the numbers run 1..66 without a gap. Chapter XXVIII begins inside
section 48, so that section is split in two paragraphs.

The few repairs that need a human decision (a displaced word, quotation marks that the OCR lost)
are the exact, commented entries of RAW_FIXES below. Every fix must match exactly once.

Usage (isolated mode; the data is never executed):

    python3 -I clean.py --raw raw-layout.txt --out clean.txt --log clean.log

Exit code 0 only if every invariant holds: 36 chapters in order, each page head names the chapter
that is current at the end of its page, sections 1..66 in order, no digits, reference leftovers,
English words or brackets in the Latin, every section but the first begins after a line that ends
a sentence, and the text ends with "Amen.".
"""

import argparse
import re
import sys
import unicodedata

FIRST_PAGE = 29  # printed page 23: "DE SPIRITU ET LITTERA / CHAPTER I"
LAST_PAGE = 103  # printed page 97: the treatise ends with "Amen."
APPENDIX_PAGE = 104  # printed page 98: Retractationes ii. 37 (not part of the treatise)
NUM_CHAPTERS = 36
NUM_SECTIONS = 66
PARAGRAPH_INDENT = "    "


def roman(value):
    out = ""
    for letter, n in (("L", 50), ("XL", 40), ("X", 10), ("IX", 9), ("V", 5), ("IV", 4), ("I", 1)):
        while value >= n:
            out += letter
            value -= n
    return out


# --------------------------------------------------------------------------------------------
# Exact fixes of the raw page text, applied first. (raw page, find, replace, why). `find` must
# occur exactly once on the page. Two kinds: the order or loss of single lines, and the quotation
# marks of the edition. The edition prints ‘...’ around the words of an opponent and around
# terms; the OCR read them as a straight ' and often lost the opening one. Each restoration below
# is the one mark that the sense of the sentence requires (the Latin itself is untouched).
# Repairs of letters and words are in the ingest config.
# --------------------------------------------------------------------------------------------
RAW_FIXES = [
    # --- lines -------------------------------------------------------------------------------
    (31, "perspexerit.\n:\n4. Sed illis", "perspexerit.\n4. Sed illis",
     "stray ':' line: the colon printed after 'fallitur' was displaced by the OCR (next fix)"),
    (31, "falli-\ntur si tamen", "falli-\ntur: si tamen",
     "the displaced colon, put back after 'fallitur'"),
    (37, "ut inebrientur ab ii.\n", "ut inebrientur ab\n",
     "'ii.' is the rest of a marginal reference (Ps. xxxv.) glued to the line"),
    (50, "Quod\n22. Quid igitur interest, breviter dicam.\n",
     "22. Quid igitur interest, breviter dicam. Quod\n",
     "'Quod' closes the line of section 22 in the print; the OCR put it before the line"),
    (57, "auferetur velamen.\nin\nCHAPTER XVI", "auferetur velamen.\nCHAPTER XVI",
     "stray 'in' of a broken marginal reference ('in ... xiii. 10.')"),
    (65, "lumen?\nhac vita dicit ipse Dominus, Haec est autem\n",
     "lumen?\nDe hac vita dicit ipse Dominus, Haec est autem vita\n",
     "'De' (the OCR joined it to the marginal reference 'De Ps. xxxv.') and 'vita' (put after the "
     "footnote) belong to this line of the print: 'De hac vita dicit ipse Dominus, Haec est autem vita'"),
    (65, "De Ps. xxxv.\nvita John xvii. 3.\n(xxxvi.) 10.", "Ps. xxxv.\nJohn xvii. 3.\n(xxxvi.) 10.",
     "the marginal reference without the two words that belong to the Latin line (previous fix)"),
    (101, "desiderat. (His constitutis pec- [Qu, insert\n", "desiderat. (His constitutis pec-\n",
     "first piece of the editor's query '[Qu. insert Verum this before ecce, Bened.]'"),
    (101, "aliquando alicui Verum\n", "aliquando alicui\n", "second piece of the editor's query"),
    (101, "in illis Bened.]\n", "in illis\n", "third piece of the editor's query"),
    (101, "30.\nthis before\necce,'", "", "last pieces of the editor's query and a digit of a reference"),
    (102, "1 Johni. 8.", "1 John i. 8.", "marginal reference 'John' and 'i.' run together"),
    # --- quotation marks -----------------------------------------------------------------------
    (40, "14. Sed laudamus,' inquiunt, et Deum nostrae",
     "14. \u2018Sed laudamus,\u2019 inquiunt, \u2018et Deum nostrae", "opponent's words, two pieces"),
    (41, "vivere debeamus.'", "vivere debeamus.\u2019", "end of the second piece (section 14)"),
    (50, "ideo non sunt 'opera' quae", "ideo non sunt \u2018opera\u2019 quae", "a term"),
    (51, "Deus, 'Fac quod jubeo:' lege fidei dicitur Deo, 'Da",
     "Deus, \u2018Fac quod jubeo:\u2019 lege fidei dicitur Deo, \u2018Da", "two sayings"),
    (51, "quod jubes.' Ideo", "quod jubes.\u2019 Ideo", "end of the second saying"),
    (52, "est, litteram occidentem' appellat", "est, \u2018litteram occidentem\u2019 appellat",
     "a term (the opening mark was lost)"),
    (67, "suo et fratri suo, Cognosce Dominum?' An forte",
     "suo et fratri suo, \u2018Cognosce Dominum?\u2019 An forte", "words of Jeremiah (opening lost)"),
    (72, "enim aliquis, 'Si Deus hinc", "enim aliquis, \u2018Si Deus hinc", "opponent's objection, opening"),
    (72, "quod his natura jam praestitit ? '", "quod his natura jam praestitit?\u2019",
     "its end (a space before '?' and the closing mark)"),
    (74, "aliud, 'justificati,' quam", "aliud, \u2018justificati,\u2019 quam", "a term"),
    (74, "ut diceremus,' Homines\nliberabuntur;' hoc", "ut diceremus, \u2018Homines\nliberabuntur;\u2019 hoc",
     "an example sentence (the OCR glued the opening mark to the comma)"),
    (74, "mus,' Homines creabuntur;' non", "mus, \u2018Homines creabuntur;\u2019 non", "an example sentence"),
    (75, "Ita si dictum esset, Factores legis honorabuntur ;'",
     "Ita si dictum esset, \u2018Factores legis honorabuntur;\u2019", "an example sentence (opening lost)"),
    (75, "Factores legis creabuntur, non qui \u00b3 erant, sed ut sint ; '",
     "\u2018Factores legis creabuntur, non qui \u00b3 erant, sed ut sint;\u2019", "an example sentence (opening lost)"),
    (75, "retur, 'justi habebuntur, justi deputabuntur,' sicut",
     "retur, \u2018justi habebuntur, justi deputabuntur,\u2019 sicut", "a saying"),
    (75, "ter dicimus, 'Deus sanctificat sanctos suos:' aliter",
     "ter dicimus, \u2018Deus sanctificat sanctos suos:\u2019 aliter", "a saying"),
    (81, "sit 'ex fide,' et aliud 'per fidem;' sed", "sit \u2018ex fide,\u2019 et aliud \u2018per fidem;\u2019 sed",
     "two phrases"),
    (86, "solent dicere: Quod habes in", "solent dicere: \u2018Quod habes in", "a saying (opening lost)"),
    (86, "ut hoc malo careas?' Et", "ut hoc malo careas?\u2019 Et", "its end"),
    (86, "dere et dicere: Facerem, si esset in potestate.' Quid",
     "dere et dicere: \u2018Facerem, si esset in potestate.\u2019 Quid", "a saying (opening lost)"),
    (86, "Sed aliter dicimus. Non mihi habuit\nfidem:' aliter,' Non mihi servavit fidem.' Nam illud est,\n"
     "'Non credidit quod dixi:' illud, 'Non fecit quod\ndixit.' Secundum",
     "Sed aliter dicimus. \u2018Non mihi habuit\nfidem:\u2019 aliter, \u2018Non mihi servavit fidem.\u2019 Nam illud est,\n"
     "\u2018Non credidit quod dixi:\u2019 illud, \u2018Non fecit quod\ndixit.\u2019 Secundum",
     "four sayings (the OCR glued two opening marks to the comma, lost the first)"),
    (90, "utrum 'spem justi-\ntiae' dixerit", "utrum \u2018spem justi-\ntiae\u2019 dixerit", "a phrase"),
    (91, "possimus, 'Ecce habemus", "possimus, \u2018Ecce habemus", "an objection, opening"),
    (91, "quod non acceperimus.' Si autem", "quod non acceperimus.\u2019 Si autem", "its end"),
    (92, "'Volo ut hi omnes servi mei", "\u2018Volo ut hi omnes servi mei", "an example, opening"),
    (92, "in pistrino semper molat:' videtur", "in pistrino semper molat:\u2019 videtur", "its end"),
    (97, "proposui: 'Si a me quaeratur,' inquam, ' utrum",
     "proposui: \u2018Si a me quaeratur,\u2019 inquam, \u2018utrum", "quotation of Augustine's own earlier text, two pieces"),
    (97, "possit quod ostenderit.' Tibi autem", "possit quod ostenderit.\u2019 Tibi autem", "its end"),
    (98, "Domino Deo nostro, sursum\n", "Domino Deo nostro, \u2018sursum\n", "a liturgical phrase, opening lost"),
    (98, "cor habentes,' unde", "cor habentes,\u2019 unde", "its end"),
]

# A section number that the OCR misread: section -> the strings that stand for "<n>." in the raw.
SECTION_NUMBER_OCR = {46: ["4.6."], 60: ["\u20ac0."]}

# A chapter that begins inside a numbered section (no number at its start): chapter -> first word.
UNNUMBERED_CHAPTER_START = {"XXVIII": "VERUMTAMEN"}

# --------------------------------------------------------------------------------------------
# Vocabulary of the marginal references. A reference is a sequence of "units": a book, roman
# numerals, numbers, and a few abbreviations. Latin has no digits, so a number is always an
# apparatus; roman numerals are only taken in a sequence that also has a book or a number.
# --------------------------------------------------------------------------------------------
BOOK = (
    r"(?:[123]\s?)?(?:Rom|Matt|Mark|Luke|John|Acts|Gal|Eph|Phil|Col|Heb|James|Tit|Tim|Cor|Pet|"
    r"Gen|Exod|Lev|Deut|Josh|Judg|Isa|Jer|Eccles|Ecclus|Prov|Wisd|Job|Joel|Ps|Kings|Mer|Pecc)"
)
PAREN_ROMAN = r"\([ivxlcIe]{1,8}\.?\)[.,]?"
ROMAN_TOKEN = r"[ivxlcI]{1,8}[.,]"
NUMBER_TOKEN = r"\d+(?:\s?[-\u2013,;]\s?\d+)*(?:\s?(?:sq|ff)\.)?[-\u2013;,.]?"
UNIT_KINDS = [
    ("book", rf"{BOOK}[.,]?(?=\s*[\divxlcI(]|\s*$)"),
    ("book", r"De\s+(?:Pecc|Ps)\.?"),
    ("book", r"\(1\s+Kings\)"),
    ("book", r"\(al\.(?=\s*[ivxlcI])"),  # "(al. v. 17." is "Gal. v. 17." with the G cut off
    ("cp", r"(?:Cp|Cf|Of)\."),
    ("book", r"See\s+below,"),
    ("misc", r"p\.(?=\s*\d)"),
    ("misc", r"s\.(?=\s*\d)"),  # "Mer. ii. s. 7."
    ("end", r"sq\.|&c\.|LXX\.|S-"),
    ("paren", PAREN_ROMAN),
    ("roman", ROMAN_TOKEN),
    ("number", NUMBER_TOKEN),
    ("number", r"(?<=[ivxlcI][.,] )[sS]\."),  # a verse number "8." read as "s."
]
UNIT = "(?:" + "|".join(p for _, p in UNIT_KINDS) + ")"
SEP = r"(?:\s+|(?<=[.,;)]))"
TAIL_RE = re.compile(rf"\s+{UNIT}(?:{SEP}{UNIT})*\s*$")
HEAD_RE = re.compile(rf"^\s*{UNIT}(?:{SEP}{UNIT})*(?=\s|$)")
LINE_RE = re.compile(rf"^\s*{UNIT}(?:{SEP}{UNIT})*\s*$")
KIND_RES = [(kind, re.compile(p)) for kind, p in UNIT_KINDS]
WS = re.compile(r"\s*")

HEAD_PATTERNS = [
    re.compile(r"^\d{1,3}$"),
    re.compile(r"^DE SPIRITU ET LITTERA(?:\s+\[CHAP\. [IVXL]+)?$"),
    re.compile(r"^\d{1,3}\s+DE SPIRITU ET LITTERA(?:\s+\[CHAP\. [IVXL]+)?$"),
    re.compile(r"^\[CHAP\. [IVXL]+$"),
    re.compile(r"^CHAP\. [IVXL]+\]?(?:\s+DE SPIRITU ET LITTERA)?(?:\s+\d{1,3})?$"),
    re.compile(r"^[A-Z]{1,2}$"),  # scan noise between the lines of a head ("HA")
]
HEAD_CHAPTER_RE = re.compile(r"CHAP\. ([IVXL]+)")
SIGNATURE_RE = re.compile(r"^(?:\d{4}|[A-Z\u13a0\u0e22](?:\s?\d)?)$")
SUPERSCRIPTS = "\u00b9\u00b2\u00b3\u2074-\u2079"
FOOTNOTE_RE = re.compile(rf"^(?:[{SUPERSCRIPTS}]|\d{{1,2}})\s+\S.*\sV\.?$")
FOOTNOTE_READING_RE = re.compile(r"^(?!CHAPTER\s)\S.*\sV\.?$")  # "CHAPTER V" is not one
FOOTNOTE_MARK_ONLY_RE = re.compile(rf"^(?:[{SUPERSCRIPTS}]|\d{{1,2}})$")
CHAPTER_RE = re.compile(r"^CHAPTER\s+([IVXL]+)$")
SUPERSCRIPT_RE = re.compile(rf"\s*[{SUPERSCRIPTS}]+")
LONE_DIGIT_RE = re.compile(r"(?<=\s)\d{1,2}(?=\s|$)")
NOISE_ONLY_RE = re.compile(r"^[\s()\[\]:;,.'\"\u2018\u2019\u201c\u201d-]+$")
SENTENCE_END_RE = re.compile(r"[.?!:;][\u2019\u201d)\]]*$")
OPENING_RE = r"[\u2018\u201c(]?"


class Log:
    def __init__(self):
        self.lines = []

    def add(self, what, page, text):
        self.lines.append(f"p{page:03d} {what:<10} {text}")


def fail(message):
    sys.exit(f"clean.py: {message}")


def apply_raw_fixes(pages, log):
    for page, find, replace, why in RAW_FIXES:
        text = pages[page - 1]
        if text.count(find) != 1:
            fail(f"raw fix for page {page} does not match exactly once: {find!r}")
        pages[page - 1] = text.replace(find, replace)
        log.add("RAW-FIX", page, f"{find!r} -> {replace!r}  ({why})")


def strip_head(lines, page, log, heads):
    """Removes the running head (up to four lines at the top of the page)."""
    out = list(lines)
    removed = 0
    while out and removed < 4:
        index = next((i for i, l in enumerate(out) if l.strip()), None)
        if index is None:
            break
        text = out[index].strip()
        if any(p.match(text) for p in HEAD_PATTERNS):
            log.add("HEAD", page, text)
            chapter = HEAD_CHAPTER_RE.search(text)
            if chapter:
                heads[page] = chapter.group(1)
            del out[index]
            removed += 1
        else:
            break
    return out


def strip_foot(lines, page, log):
    """Removes signature marks and the footnotes (variant readings of the CSEL)."""
    out = [l.rstrip() for l in lines]
    while True:  # signature marks at the very end
        last = next((i for i in range(len(out) - 1, -1, -1) if out[i].strip()), None)
        if last is not None and SIGNATURE_RE.match(out[last].strip()):
            log.add("SIGNATURE", page, out[last].strip())
            del out[last]
        else:
            break
    keep = []  # "<mark> <reading> V." on one line, or a mark line followed by a reading line
    i = 0
    while i < len(out):
        text = out[i].strip()
        nxt = out[i + 1].strip() if i + 1 < len(out) else ""
        if FOOTNOTE_RE.match(text) or FOOTNOTE_READING_RE.match(text):
            log.add("FOOTNOTE", page, text)  # the marker may be lost: "torrentem... potent V"
            i += 1
        elif FOOTNOTE_MARK_ONLY_RE.match(text) and FOOTNOTE_READING_RE.match(nxt):
            log.add("FOOTNOTE", page, f"{text} {nxt}")
            i += 2
        else:
            keep.append(out[i])
            i += 1
    return keep


def strip_fragment_strip(lines, page, log):
    """A run of five or more lines of at most three characters at the end of a page is scan noise."""
    end = len(lines)
    while end > 0 and not lines[end - 1].strip():
        end -= 1
    start = end
    while start > 0 and 0 < len(lines[start - 1].strip()) <= 3:
        start -= 1
    if end - start >= 5:
        for l in lines[start:end]:
            log.add("NOISE-RUN", page, l.strip())
        return lines[:start]
    return lines


def split_units(seq):
    """Splits a matched reference sequence into (kind, text, start, end) units."""
    units = []
    pos = 0
    while True:
        pos = WS.match(seq, pos).end()
        if pos >= len(seq):
            return units
        for kind, rx in KIND_RES:
            m = rx.match(seq, pos)
            if m and m.end() > pos:
                units.append((kind, m.group(0), pos, m.end()))
                pos = m.end()
                break
        else:
            fail(f"cannot split the reference {seq!r} at {pos}")


def is_anchored(units):
    return any(kind in ("book", "number", "end", "paren") for kind, *_ in units)


def is_ref_line(text):
    m = LINE_RE.match(text)
    if not m:
        return False
    return is_anchored(split_units(text))


def side_of(page):
    """Odd printed pages (odd raw pages here) have the margin on the right, even ones on the left."""
    return "right" if page % 2 == 1 else "left"


def clean_body_line(text, page, log):
    """Returns the Latin of a body line, or None if the whole line is apparatus or noise."""
    stripped = text.strip()
    if not stripped:
        return None
    if NOISE_ONLY_RE.match(stripped):
        log.add("NOISE", page, stripped)
        return None
    if re.fullmatch(r"\d{1,2}", stripped) or is_ref_line(stripped):
        log.add("REF-LINE", page, stripped)
        return None
    return stripped


def strip_edge_refs(text, page, log, expected_section):
    """Cuts marginal references from the margin side of a Latin line; returns the rest."""
    if side_of(page) == "right":
        m = TAIL_RE.search(text)
        if not m:
            return text
        units = split_units(m.group(0))
        while units and units[0][0] not in ("book", "cp", "misc", "number", "paren"):
            units.pop(0)  # a roman numeral cannot open a reference ("illi, 7.")
        if not units or not is_anchored(units):
            return text
        start = m.start() + units[0][2]
        if not text[:start].strip():
            return text
        log.add("REF-END", page, text[start:].strip())
        return text[:start].rstrip()

    m = HEAD_RE.match(text)
    if not m:
        return text
    units = split_units(m.group(0))
    while units:
        kind = units[-1][0]
        if kind in ("number", "end", "paren"):
            break
        if kind == "roman" and len(units) >= 2 and units[-2][0] in ("book", "cp"):
            break  # "Rom. xiii.": the verse is on another line
        units.pop()  # a Latin word like "illi," can look like a roman numeral
    if not units:
        return text
    # "Acts xiii. 9. 12. Ideo ...": the last number is the section number, not a verse
    kind, token, start, last_end = units[-1]
    rest = text[last_end:]
    if (
        kind == "number"
        and token.strip(".") == str(expected_section)
        and re.match(rf"\s*{OPENING_RE}[A-Z]", rest)
        and not (len(units) > 1 and units[-2][0] == "roman")
    ):
        units.pop()
        if not units or not is_anchored(units):
            return text
        cut = units[-1][3]
        log.add("REF-START", page, text[:cut].strip())
        return text[cut:].lstrip()
    if not is_anchored(units):
        return text
    log.add("REF-START", page, text[:last_end].strip())
    return rest.lstrip()


def remove_footnote_marks(text, page, log):
    found = SUPERSCRIPT_RE.findall(text)
    if found:
        log.add("FN-MARK", page, f"{''.join(f.strip() for f in found)}  in: {text!r}")
        text = SUPERSCRIPT_RE.sub("", text)
    for m in LONE_DIGIT_RE.finditer(text):
        log.add("FN-MARK", page, f"{m.group(0)}  in: {text!r}")
    text = LONE_DIGIT_RE.sub("", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def section_prefix(text, number):
    """If `text` starts with the number of the section, returns the text after it, else None."""
    for candidate in [f"{number}."] + SECTION_NUMBER_OCR.get(number, []):
        if text.startswith(candidate):
            rest = text[len(candidate):]
            if rest[:1].isspace() and re.match(rf"{OPENING_RE}[A-Z]", rest.strip()):
                return rest.strip()
    return None


def titlecase_first_word(text):
    """The first word of a chapter is printed in capitals ("LECTIS"); the edition's case is lost."""
    match = re.match(rf"({OPENING_RE})([A-Z]{{2,}})\b", text)
    if match:
        word = match.group(2)
        return match.group(1) + word[0] + word[1:].lower() + text[match.end():]
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--raw", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--log", required=True)
    args = parser.parse_args()

    with open(args.raw, encoding="utf-8") as handle:
        raw = unicodedata.normalize("NFC", handle.read())
    pages = raw.split("\f")
    if len(pages) != 112:
        fail(f"expected 112 pages in the raw file, found {len(pages)}")
    if "DE SPIRITU ET LITTERA\nCHAPTER I\n" not in pages[FIRST_PAGE - 1]:
        fail(f"page {FIRST_PAGE} does not open the treatise")
    if "RETRACTATIONS" not in pages[APPENDIX_PAGE - 1]:
        fail(f"page {APPENDIX_PAGE} is not the appendix")
    if "saecu-\nlorum. Amen." not in pages[LAST_PAGE - 1]:
        fail(f"page {LAST_PAGE} does not end the treatise")

    log = Log()
    apply_raw_fixes(pages, log)

    out_pages = []
    heads = {}  # raw page -> chapter named by its running head
    chapter_at_end = {}  # raw page -> chapter in force at the end of the page
    chapter = 0
    section = 0
    state = "start"  # "start" | "summary" (after a CHAPTER line) | "body"
    current_chapter = None
    last_line = None
    section_starts = []  # (section, raw page, previous Latin line)

    for page in range(FIRST_PAGE, LAST_PAGE + 1):
        lines = pages[page - 1].split("\n")
        lines = strip_head(lines, page, log, heads)
        lines = strip_foot(lines, page, log)
        lines = strip_fragment_strip(lines, page, log)
        out = []
        for original in lines:
            text = clean_body_line(original, page, log)
            if text is None:
                continue

            marker = CHAPTER_RE.match(text)
            if marker:
                chapter += 1
                if marker.group(1) != roman(chapter):
                    fail(f"p{page}: expected CHAPTER {roman(chapter)}, found {marker.group(1)}")
                current_chapter = marker.group(1)
                state = "summary"
                out += [f"CHAPTER {current_chapter}", current_chapter, ""]
                log.add("CHAPTER", page, current_chapter)
                continue
            if state == "start":
                fail(f"p{page}: text before the first chapter marker: {text!r}")

            text = strip_edge_refs(text, page, log, section + 1)
            if not text.strip():
                continue
            if state == "summary":
                numbered = section_prefix(text, section + 1)
                unnumbered = UNNUMBERED_CHAPTER_START.get(current_chapter)
                if numbered is None and not (unnumbered and text.startswith(unnumbered)):
                    log.add("SUMMARY", page, text)  # the editor's English heading and summary
                    continue
                state = "body"
                if numbered is None:
                    log.add("UNNUMBERED", page, f"chapter {current_chapter} begins inside section {section}")
                    first = text
                else:
                    section += 1
                    log.add("SECTION", page, str(section))
                    section_starts.append((section, page, last_line))
                    first = numbered
                first = remove_footnote_marks(titlecase_first_word(first), page, log)
                out.append(PARAGRAPH_INDENT + first)
                last_line = first
                continue

            text = remove_footnote_marks(text, page, log)
            numbered = section_prefix(text, section + 1)
            if numbered is not None:
                section += 1
                log.add("SECTION", page, str(section))
                section_starts.append((section, page, last_line))
                out.append(PARAGRAPH_INDENT + titlecase_first_word(numbered))
                last_line = numbered
            else:
                out.append(text)
                last_line = text
        chapter_at_end[page] = roman(chapter) if chapter else None
        out_pages.append(out)

    # ---- invariants ---------------------------------------------------------------------------
    problems = []
    if chapter != NUM_CHAPTERS:
        problems.append(f"{chapter} chapters found, expected {NUM_CHAPTERS}")
    if section != NUM_SECTIONS:
        problems.append(f"{section} sections found, expected {NUM_SECTIONS}")
    if last_line is None or not last_line.endswith("Amen."):
        problems.append(f"the text does not end with 'Amen.': {last_line!r}")
    for page, numeral in sorted(heads.items()):
        if chapter_at_end.get(page) != numeral:
            problems.append(f"p{page}: the head names chapter {numeral}, the text is in {chapter_at_end.get(page)}")
    for number, page, previous in section_starts:
        if previous is not None and not SENTENCE_END_RE.search(previous):
            problems.append(f"section {number} (p{page}) follows a line that does not end a sentence: {previous!r}")

    for line in (l.strip() for page in out_pages for l in page):
        if not line or CHAPTER_RE.match(line) or re.fullmatch(r"[IVXL]{1,6}", line):
            continue
        if re.search(r"\d", line.replace("\u00b3", "")):
            problems.append(f"digit in a Latin line: {line!r}")
        if re.search(rf"\b{BOOK}(?:[.,]|\s)\s*[ivxlcI\d(]", line) and "libro Job legitur" not in line:
            problems.append(f"reference leftover in a Latin line: {line!r}")
        if re.search(r"\b(?:the|of|and|See|Cp|Cf)\b", line):
            problems.append(f"English word in a Latin line: {line!r}")
        if re.search(r"(?:^|[^A-Za-z])(?:x{0,3}(?:ix|iv|v?i{1,3})|x{1,3})[.,;:](?:[^A-Za-z]|$)", line):
            problems.append(f"roman numeral in a Latin line: {line!r}")
        if re.search(r"\sV\.?$", line):
            problems.append(f"footnote reading in a Latin line: {line!r}")
        if re.search(r"[\[\]]|\([ivxlc]+\.\)", line):
            problems.append(f"bracket or parenthesised numeral in a Latin line: {line!r}")

    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write("\f".join("\n".join(page) + "\n" for page in out_pages))
    with open(args.log, "w", encoding="utf-8") as handle:
        handle.write("\n".join(log.lines) + "\n")

    kinds = {}
    for entry in log.lines:
        kind = entry[5:].split()[0]
        kinds[kind] = kinds.get(kind, 0) + 1
    print(f"chapters {chapter}, sections {section}, output pages {len(out_pages)}")
    print("log: " + ", ".join(f"{k} {v}" for k, v in sorted(kinds.items())))
    if problems:
        for problem in problems:
            print(f"PROBLEM: {problem}")
        sys.exit(1)


if __name__ == "__main__":
    main()
