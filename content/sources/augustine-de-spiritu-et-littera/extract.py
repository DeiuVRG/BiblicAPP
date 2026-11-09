"""Builds raw-layout.txt (and raw.txt) from the per-page text files of the source volume.

The volume of the inventory entry P2D-02 is not a PDF: it is a directory of 112 page-text files
(HathiTrust/Cornell OCR text, barcode 31924029218629, names 00000001.txt ... 00000112.txt). There is
therefore nothing for `pdftotext` to extract. This script does the equivalent step: it joins the
page files in order, one page per form feed, byte for byte (no line is changed, nothing is
re-encoded or normalised), so that page N of the output is the file 000000NN.txt.

The page texts carry no layout beyond their line breaks, so the "layout" and the "plain" extraction
of `pdftotext` do not differ for this source: raw-layout.txt and raw.txt are byte-identical.

Usage (run with isolated mode, the data is never executed):

    python3 -I extract.py --pages-dir <dir with 00000001.txt ...> [--out-dir <dir>]

The input is untrusted data. Only the names `NNNNNNNN.txt` (exactly 1..112) are read, as UTF-8.
"""

import argparse
import hashlib
import os
import re
import sys

EXPECTED_PAGES = 112
PAGE_NAME = re.compile(r"^(\d{8})\.txt$")


def read_pages(pages_dir):
    names = sorted(n for n in os.listdir(pages_dir) if PAGE_NAME.match(n))
    numbers = [int(PAGE_NAME.match(n).group(1)) for n in names]
    if numbers != list(range(1, EXPECTED_PAGES + 1)):
        sys.exit(
            f"expected the page files 1..{EXPECTED_PAGES} without gaps, found {len(numbers)} "
            f"files ({numbers[:3]} ... {numbers[-3:]})"
        )
    pages = []
    for name in names:
        with open(os.path.join(pages_dir, name), "rb") as handle:
            data = handle.read()
        if b"\f" in data or b"\r" in data:
            sys.exit(f"{name}: unexpected form feed or carriage return in a page file")
        data.decode("utf-8")  # strict: raises on invalid UTF-8
        pages.append((name, data))
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--pages-dir", required=True)
    parser.add_argument("--out-dir", default=os.path.dirname(os.path.abspath(__file__)))
    args = parser.parse_args()

    pages = read_pages(args.pages_dir)
    joined = b"\f".join(data for _, data in pages)

    for name in ("raw-layout.txt", "raw.txt"):
        with open(os.path.join(args.out_dir, name), "wb") as handle:
            handle.write(joined)
    with open(os.path.join(args.out_dir, "raw-pages.sha256"), "w", encoding="utf-8") as handle:
        for name, data in pages:
            handle.write(f"{hashlib.sha256(data).hexdigest()}  {name}\n")

    print(f"pages: {len(pages)}, bytes: {len(joined)}")
    print(f"sha256 raw-layout.txt = raw.txt: {hashlib.sha256(joined).hexdigest()}")


if __name__ == "__main__":
    main()
