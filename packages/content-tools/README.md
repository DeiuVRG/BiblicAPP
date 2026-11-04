# @biblioteca/content-tools

CLI that turns source texts into signed content packs (see `docs/m0-spec.md` section 4 and
`docs/decizii.md`, ADR-007, ADR-010, ADR-011).

```bash
pnpm --filter @biblioteca/content-tools cli -- --help
```

Relative paths are resolved against the directory you ran `pnpm` from (`INIT_CWD`), so run the
commands from the repository root.

| Command       | Purpose                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `ingest-text` | raw `pdftotext` output -> cleaned canonical edition JSON (`content/works/...`)  |
| `build-pack`  | canonical edition JSON -> `pack.json` + `manifest.json` (sha256 + Ed25519)      |
| `verify-pack` | byte-exact verification of a built pack against pinned public keys              |
| `keygen`      | generate an Ed25519 keypair (private key to `content/keys/`, gitignored)        |

## Pipeline for a new work

```bash
# 1. Extract text. -layout keeps indentation (paragraph starts) and line-end hyphens.
pdftotext -layout book.pdf content/sources/<slug>/raw-layout.txt

# 2. Describe the work (work.json: metadata, ids may be omitted) and tune ingest.config.json.
#    Then clean it. Re-running keeps every existing id (output is byte-identical if nothing changed).
pnpm --filter @biblioteca/content-tools cli ingest-text content/sources/<slug>/raw-layout.txt \
  --work content/works/<slug>/work.json --verbose

# 3. Build and sign (dev key: content/keys/dev.key, never committed).
pnpm --filter @biblioteca/content-tools cli build-pack content/works/<slug>/edition-en.json \
  --out apps/mobile/assets/packs/<slug>-en

# 4. Verify (exit code 0 = valid) and list the pack in apps/mobile/src/content/bundled-packs.ts.
pnpm --filter @biblioteca/content-tools cli verify-pack apps/mobile/assets/packs/<slug>-en
```

The sample (Vos, 1903) was extracted with `pdftotext -layout` from
`incoming/part1/vos_1903_teaching_of_jesus_kingdom.pdf` (poppler 24.02).

## Keys

```bash
pnpm --filter @biblioteca/content-tools cli keygen --name dev --id dev-2026-11
```

`content/keys/dev.pub` is committed and pinned in `apps/mobile/src/content/trusted-keys.ts`
(a test keeps both in sync). CI signing: pass the private key JSON in an environment variable
(`build-pack --key-env SIGNING_KEY`); never commit it.

## How `ingest-text` cleans a text

All heuristics are data, in `ingest.config.json` next to the work:

- front matter before `firstChapterMarker` is dropped (`--keep-front-matter` keeps it), everything
  from `endMarker` on is dropped (printed indices);
- running heads are found by repetition with OCR-tolerant similarity and by the sequence of
  printed page numbers; page numbers and signature marks at the foot are removed;
- line-end hyphens are resolved from the text's own usage (compound seen inside a line -> keep);
- paragraphs start at an indented line, at an OCR mark that replaced the indent, or after a short
  line that ends a sentence (`length` mode for plain `pdftotext` output);
- chapter headings come from `chapters[]` (OCR text of headings is unreliable), drop caps and
  other one-off damage from `pageFixes[]`, recurring OCR damage from `replacements[]` and
  `wordFixes{}`; straight quotes become typographic quotes.

`--verbose` prints removed foot lines, indented lines that were not accepted as paragraph starts,
paragraph starts decided by the short-line cue only, and every hyphen decision, for review.

## Tests

`pnpm --filter @biblioteca/content-tools test` (Vitest): dehyphenation, paragraph joining,
running-head removal, heading detection, id stability, sign/verify round trip, tampering,
CLI end to end, and checks on the committed sample pack.
