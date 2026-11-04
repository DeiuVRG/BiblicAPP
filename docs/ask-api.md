# Ask API (`apps/api`)

The "Ask" gateway of the library: a small HTTP service that answers a question **only from the
passages of the signed content packs**, with inline citations. It is the first slice of the `api`
service described in `docs/arhitectura-app-biblica.md` (sections 4 to 6): Hono on Node 22, the Claude
API behind an `AIProvider` interface, deployed on Fly.io in Frankfurt.

This is the **beta without accounts**: there is no sign-in, no consent screen and no per-user budget
yet (see [What is deferred](#what-is-deferred)). While the beta is limited to testers it is closed
by an **access code** (`ACCESS_CODE`, sent as the header `X-Access-Code`); without that variable it
is open. Abuse and cost are limited by that code, a per-IP rate limit, a global daily question cap
and, above all, by a spend limit you set in the Anthropic Console (see
[Costs](#costs-and-spend-limits)).

- [Run it locally](#run-it-locally)
- [Endpoint contract](#endpoint-contract)
- [How an answer is made](#how-an-answer-is-made)
- [Configuration](#configuration)
- [Limits, privacy and security](#limits-privacy-and-security)
- [Suggestions and evaluation set v0](#suggestions-and-evaluation-set-v0)
- [Deploying to Fly.io (steps for the owner)](#deploying-to-flyio-steps-for-the-owner)
- [Costs and spend limits](#costs-and-spend-limits)
- [What is deferred](#what-is-deferred)
- [What the app has to pick up](#what-the-app-has-to-pick-up)
- [Decisions and deviations](#decisions-and-deviations)

## Run it locally

From the repository root, after `pnpm install`:

```bash
# Mock mode: no key, no network. Deterministic answers that quote and cite the first two sources.
AI_PROVIDER=mock pnpm --filter @biblioteca/api dev          # tsx watch, http://localhost:8787

# Real model: needs an Anthropic API key in the environment (never in a file in the repository).
AI_PROVIDER=claude ANTHROPIC_API_KEY=... pnpm --filter @biblioteca/api dev

# The production bundle, as the Docker image runs it:
pnpm --filter @biblioteca/api build                          # typecheck + dist/server.js
AI_PROVIDER=mock pnpm --filter @biblioteca/api start         # node dist/server.js
```

The defaults point into the checkout (`apps/mobile/assets/packs`, `content/keys`), so the packs
that ship with the app are what Ask searches. `apps/api/.env.example` lists every variable.

Try it:

```bash
curl -s localhost:8787/v1/health
curl -s localhost:8787/v1/library
curl -sN -X POST localhost:8787/v1/ask -H 'content-type: application/json' \
  -d '{"question":"What does Vos say about the kingdom of heaven?","language":"en"}'
curl -s -X POST 'localhost:8787/v1/ask?stream=false' -H 'content-type: application/json' \
  -d '{"question":"Împărăția cerurilor","language":"ro"}'

# A closed beta (the server started with ACCESS_CODE=<code>): every question carries the code.
curl -sN -X POST localhost:8787/v1/ask -H 'content-type: application/json' -H 'X-Access-Code: <code>' \
  -d '{"question":"What does the Sermon on the Mount teach about the kingdom?","language":"en"}'

# Limit the search to one work, and ask about a paragraph the person selected in the reader
# (ids from GET /v1/library and from the packs):
curl -s -X POST 'localhost:8787/v1/ask?stream=false' -H 'content-type: application/json' \
  -d '{"question":"What does this mean?","language":"en","scope":{"workId":"<work id>"},"passage":{"editionId":"<edition id>","paragraphId":"<paragraph id>"}}'

# The evaluation set, with the mock provider (writes content/ask/eval-v0.report.json):
pnpm --filter @biblioteca/api eval
```

Checks (all part of `pnpm -r typecheck | lint | test` from the root):
`pnpm --filter @biblioteca/api typecheck`, `... lint`, `... test` (Vitest: retrieval on the real
Vos packs, scripture references, citations, SSE framing, rate limiting, CORS, configuration,
mock end to end through a started server, the Claude provider against a stand-in API, health,
library, graceful shutdown, packaging, the access code, the daily cap, scope and passage, request
ids, the quotation check per cited source, the suggestions and the evaluation set).

## Endpoint contract

All bodies are JSON (UTF-8). Every response carries `X-Request-Id`. Errors have one shape, and the
body names the request too (`requestId`: the value of the header and of the log lines, so that a
failure seen on a phone can be traced from the "Detalii" disclosure of the app):

```json
{ "error": { "code": "invalid_request", "message": "question: must not be empty", "requestId": "5d5db93e-...", "issues": [{ "path": "question", "message": "must not be empty" }] } }
```

`issues` appears on validation errors, `retryAfterSeconds` where waiting helps (`rate_limited`,
`provider_busy`).

### `POST /v1/ask`

Request (`Content-Type: application/json` is required; when the beta is closed, that is when
`ACCESS_CODE` is set, the header `X-Access-Code: <code>` is required too, see
[The access code](#limits-privacy-and-security)):

| Field | Type | Rules |
| --- | --- | --- |
| `question` | string | 1 to 2000 characters after trimming. Text with a NUL (`U+0000`) character is refused (`400`); lone surrogates (invalid UTF-16, which JSON can carry) are replaced by `U+FFFD`. |
| `language` | `"ro"` or `"en"` | The language of the answer, and the language whose edition is shown when a passage exists in both. |
| `conversation` | `{ role: "user" \| "assistant", content: string }[]` | Optional. Earlier turns, oldest first; up to 50 are accepted (each 1 to 8000 characters after trimming, cleaned like the question: a turn of only spaces or with a NUL is a `400`) and **the last 6 are used**. Citation markers (`[1]`) in earlier answers are dropped: their numbers belonged to earlier documents; a turn that is empty once its markers are gone is left out (the model API does not take empty messages). |
| `editionIds` | `string[]` | Optional. Restrict retrieval, and the aligned versions, to these editions (ids from `GET /v1/library`). Unknown ids are ignored; if none is known the answer is `400 unknown_editions`. |
| `scope` | `{ workId: string }` | Optional. Restrict retrieval, and the aligned versions, to the editions of one work (id from `GET /v1/library`). With `editionIds` the two narrow each other: only the editions of that work that are in the list remain. A work the library does not have, or no edition left, is `400 unknown_editions` (the app's "the scope you chose no longer exists"). No other key is accepted inside `scope`. |
| `passage` | `{ editionId: string, paragraphId: string }` | Optional. The paragraph the question is about, as the person selected it in the reader (ids from the packs). Its section is searched first and the whole library tops the answer up: [How an answer is made](#how-an-answer-is-made), step 3. The paragraph must exist in that edition, be text (not a heading) and be readable in at least one of the editions that `editionIds` and `scope` leave; otherwise `400 unknown_passage` (the app may ask again without `passage`). No other key is accepted inside `passage`. |

Without a query string the response is a **Server-Sent Events stream**; with `?stream=false` it is
one JSON document.

#### Streaming (default)

`Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no` (proxies neither buffer nor rewrite the stream). Each frame is `event: <name>`, `data: <JSON>`, `id: <n>` with
`id` counting up from 1. A `: keepalive` comment is sent every 15 seconds. The order is fixed:

1. `sources`, **once, first**: the retrieved passages (an array, possibly empty).
2. `delta` many times: `{ "text": "..." }`, pieces of the answer. Pieces can cut a word or a citation
   marker anywhere; concatenate them.
3. `citation`: `{ "sourceIndex": 1, "text": "...", "offset": 230 }`, sent right after the delta that
   completes a marker such as `[1]` (one event per number in `[1, 3]`). `sourceIndex` is 1-based into
   `sources`; `text` is the sentence of the answer that carries the marker (markers removed);
   `offset` is the position of the marker in the final answer (UTF-16 units). Markers that point
   outside `sources` are not announced (they are counted in `done.invalidCitations`).
4. **Exactly one** of `done` or `error`, last.

`done`: `{ usage, model, requestId, providerRequestId?, stopReason, invalidCitations, quotations }`

- `usage`: `{ inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens }`.
- `model`: the model that produced the answer (`"mock"` in mock mode).
- `requestId`: this gateway's id (also the `X-Request-Id` header and the field in the log lines).
  `providerRequestId`: the provider's own id (Anthropic `request-id`), for support tickets.
- `stopReason`: `end_turn`, `max_tokens` (the answer was cut at 1200 tokens), `stop_sequence`,
  `other`, or `not_covered` (no passage matched; the model was not called and `usage` is zero).
- `quotations`: `{ checked, unverified, uncited, unverifiedItems }`. Every quotation in the answer
  (text between quotation marks, 20 characters or more; split at ellipses into pieces of 12
  characters or more) is checked to be word for word, modulo case, diacritics and punctuation, in
  **the sources that the sentence holding it cites**: all the valid `[n]` markers of that sentence
  together (ranges and lists included; for a translated passage the original text counts too).
  A sentence that cites no valid source falls back to all the sources of the request.
  - `checked`: how many quotations were checked. `unverified`: how many failed; it stays a count,
    so `unverified > 0` means "the model quoted something that is not there, or not where it says".
  - `uncited`: how many of the checked quotations sat in a sentence with no valid marker and were
    checked against all sources (a line such as "checked against the cited sources: n of m" counts
    `checked - uncited` of `checked`).
  - `unverifiedItems`: the failures, `{ text, sentence, offset, cited }` each: the quoted text (at
    most 200 characters, markers removed); `sentence`, the index from 0 of the sentence of the
    answer that holds it; `offset`, the position of its opening quotation mark in the answer (UTF-16
    units, like a citation's `offset`); `cited`, the numbers of the sources it was checked against
    (empty: all of them). The list has `unverified` entries. A client can show the strings and mark
    the place.

  A sentence ends at `.`, `!`, `?` or `…` followed by a space and a capital letter, a digit or a
  quotation mark, and at a line break. Text between quotation marks never ends one (a quotation of
  several sentences stays whole), unless the quotation ends with its own full stop and a new
  sentence follows. Markers right after the full stop ("... follow. [2]") belong to the sentence
  before them. A full stop after an abbreviation or an initial ("St.", "cf.", "G. Vos") or between a
  word and a number ("Matt. 4:17") does not end one. It is a heuristic with a safe failure: a wrong
  cut can only separate a quotation from its marker, and then the quotation is checked against all
  sources, as before.

`error`: `{ code, message, requestId, retryAfterSeconds? }` with a message in the language of the
question and no provider detail (`requestId` as in the JSON errors). Codes: `provider_busy`
(429/529 upstream), `provider_unavailable`, `provider_misconfigured`, `provider_error`, `timeout`
(deadline passed), `refused` (the model declined), `shutting_down`, `internal_error`. Text already
streamed stays valid. (The global daily cap, which is also `provider_busy`, is refused before the
stream starts, as an HTTP 503: see below.)

A `sources` element:

```json
{
  "id": "01M6JQPD948SXM9E7GNT39CV00",
  "workId": "01M6JQPCFFCK900E1P6353MWVK",
  "editionId": "01M6K66F2C06J665YYB3AR377H",
  "sectionId": "01M6K66F2EJ42JBNJYSS6NF0ZW",
  "paragraphId": "01M6K66F2EJ42JBNJYSS6NF0ZX",
  "workTitle": "Învățătura lui Isus despre Împărăția lui Dumnezeu și Biserică",
  "sectionHeading": "I. Introducere",
  "language": "ro",
  "excerpt": "În ansamblul învățăturii Domnului nostru, ...",
  "kind": "translation",
  "author": "Geerhardus Vos",
  "tradition": "protestant",
  "score": 6,
  "matchedRefs": ["Matt 4:17"],
  "aligned": [
    {
      "editionId": "01M6JQPCFGW7EM3S59E2BAASGZ",
      "sectionId": "01M6JQPD93RT1JA8A0C7QS6NQT",
      "paragraphId": "01M6JQPD948SXM9E7GNT39CV00",
      "language": "en",
      "kind": "source",
      "sectionHeading": "I. Introductory",
      "excerpt": "In the body of our Lord's teaching as recorded in the Gospels ..."
    }
  ]
}
```

- Sources are **numbered by position**: `sources[0]` is `[1]` in the answer. They are in order of
  relevance, best first, except when the request carries a `passage`: then the attached passage is
  `[1]`, its neighbours follow, then the best of its section, then the rest of the library, and
  `score` is `0` for a passage that is only there for context and matched no word of the question.
- `id` is the **stable id of the passage**: the id of the paragraph in the source edition, shared by
  every language version of it. `paragraphId` and `editionId` identify the version shown, which is
  the one in the asked `language` when that edition is installed and covers the paragraph, otherwise
  the original. Open the reader on `paragraphId` (or pick another version from `aligned`).
- `aligned` lists the same passage in the other installed editions (the original first): the
  alignment of the packs (`sourceId`), so a Romanian hit comes with its English original and an
  English hit with its Romanian translation when that part is translated. The model reads the
  version shown and, for a translation, the original as well.
- `excerpt` is at most about 480 characters, centred on the matching words for long paragraphs.
- `kind` is `source` (the original text) or `translation`; `author` and `tradition` are those of
  the pack; `matchedRefs` are the scripture references of the question that the passage cites: the
  same verse or an overlapping range, or, when the question names a whole chapter, a verse of it. A
  passage that cites only *another* verse of the chapter still ranks higher for the question (it is
  related) but is not listed as citing it, so a client may show `matchedRefs` as "cites ...".

Example (shortened):

```
event: sources
data: [{"id":"01M6JQPD948SXM9E7GNT39CV00","workId":"...","editionId":"...","language":"ro", ...}, ...]
id: 1

event: delta
data: {"text":"Vos susține că Împărăția "}
id: 2

...

event: citation
data: {"sourceIndex":1,"text":"Vos susține că Împărăția este deja prezentă","offset":47}
id: 17

event: done
data: {"usage":{"inputTokens":2122,"outputTokens":101,"cacheReadInputTokens":0,"cacheCreationInputTokens":0},"model":"claude-sonnet-5-5","requestId":"5d5db93e-...","providerRequestId":"req_...","stopReason":"end_turn","invalidCitations":0,"quotations":{"checked":1,"unverified":0,"uncited":0,"unverifiedItems":[]}}
id: 31
```

Reading the stream in the app (Expo): use `fetch` from `expo/fetch`, `response.body.getReader()` and
one `TextDecoder` with `{ stream: true }` (a chunk can end in the middle of a character), buffer until
a blank line, and ignore lines that start with `:`. On the web a plain `fetch` works the same way.

#### Without streaming: `POST /v1/ask?stream=false`

```json
{
  "answer": "Vos argues that the kingdom is near [1] ...",
  "sources": [ /* as above */ ],
  "citations": [{ "sourceIndex": 1, "text": "Vos argues that the kingdom is near", "offset": 40 }],
  "usage": { "inputTokens": 2122, "outputTokens": 101, "cacheReadInputTokens": 0, "cacheCreationInputTokens": 0 },
  "model": "claude-sonnet-5-5",
  "requestId": "...",
  "providerRequestId": "req_...",
  "stopReason": "end_turn",
  "invalidCitations": 0,
  "quotations": { "checked": 1, "unverified": 0, "uncited": 0, "unverifiedItems": [] }
}
```

A failure is an HTTP error with the error shape above: `502` (`provider_unavailable`,
`provider_misconfigured`, `provider_error`, `refused`), `503` (`provider_busy`, `shutting_down`,
`library_unavailable`; with `Retry-After`, and `error.retryAfterSeconds`, when known), `504`
(`timeout`), `500` (`internal_error`).

#### Other status codes

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `invalid_json`, `invalid_request`, `unknown_editions`, `unknown_passage` | The body is not JSON or fails validation (a malformed `scope` or `passage` included); none of `editionIds` is installed, `scope.workId` is not a work of the library, or `editionIds` and `scope` leave no edition (`unknown_editions`); the `passage` does not exist, is a heading, or is in none of the editions left (`unknown_passage`). |
| 401 | `access_required` | `ACCESS_CODE` is set and the header `X-Access-Code` is missing or is not one of the codes. |
| 413 | `payload_too_large` | Body over `MAX_BODY_BYTES` (64 KiB by default). |
| 415 | `unsupported_media_type` | `Content-Type` is not `application/json`. |
| 429 | `rate_limited` | Over the question limit. Also, in the closed beta, a client that has presented too many wrong access codes (`ACCESS_FAILURE_MAX` per `ACCESS_FAILURE_WINDOW_SECONDS`): it is refused, without its code being looked at, until its allowance refills (the message says "Too many wrong access codes"). `Retry-After` (seconds) and `error.retryAfterSeconds` in both cases; the lockout answer carries no `RateLimit-*` headers. |
| 503 | `provider_busy` | The global daily question cap (`DAILY_QUESTION_CAP`) is reached; `Retry-After` and `error.retryAfterSeconds` are the seconds until midnight UTC. Refused before any stream starts, in both modes; the message is in the language of the question. |
| 503 | `library_unavailable` | No pack verified at startup (see `GET /v1/health`). |

A question is checked in this order and the first failure answers: the access code (`401`; a client
that has presented too many wrong codes is refused with `429` before its code is looked at); a server
that is stopping or a library that did not load (`503 shutting_down`, `503 library_unavailable`);
the per-address limit (`429`, the only check that takes a token of the question limiter); the size,
type and JSON of the body (`413`, `415`, `400`); the scope and the passage (`400 unknown_editions`,
`400 unknown_passage`); the daily cap (`503 provider_busy`). Only then is the question retrieved and
answered.

**Telling the daily cap from a busy model.** Both are `provider_busy`; what differs is the wait. An
overloaded model says 30 s, an upstream rate limit what the provider sends (at most 600 s, and no
`retryAfterSeconds` at all when it sends nothing), the daily cap the seconds until midnight UTC (1 to
86,400). A client should show the wait it is given (`error.retryAfterSeconds`, also the `Retry-After`
header) and, when it is long (more than a minute), the localized `error.message`, which names the
cause, instead of "try again in a few seconds"; and it should not offer an immediate retry then,
because that retry would be refused again.

The responses of `GET /`, `GET /v1/health`, `GET /v1/library` and `POST /v1/ask` that reach their
rate limiter carry `RateLimit-Limit` and `RateLimit-Remaining` for the caller's bucket. `404`
answers, CORS preflights and the answers given before the limiter (`401 access_required`, the
`429` of an access lockout, `503 shutting_down`, `503 library_unavailable`) do not. Every response
carries `X-Request-Id`.

### `GET /v1/health`

```json
{ "ok": true, "packs": 2, "paragraphs": 139, "model": "claude-sonnet-5-5", "provider": "claude", "rejectedPacks": 0 }
```

`ok` is true when at least one pack verified and the server is not shutting down; otherwise the
status is `503` (Fly's check then fails and a bad deploy never takes traffic). `packs` and
`paragraphs` count what was loaded and indexed; `rejectedPacks` counts packs on disk that failed
verification (they are logged with the reason and never used). `model` is `"mock"` in mock mode.

`GET /` returns a small JSON index of the endpoints.

### `GET /v1/library`

What Ask covers, for the app to show next to the chat:

```json
{
  "works": [{
    "id": "01M6JQPCFFCK900E1P6353MWVK",
    "slug": "vos-1903-kingdom",
    "title": { "ro": "Învățătura lui Isus ...", "en": "The Teaching of Jesus ...", "original": "The Teaching of Jesus ..." },
    "author": { "name": "Geerhardus Vos", "born": 1862, "died": 1949, "tradition": "protestant" },
    "year": 1903,
    "languageOrig": "en",
    "editions": [
      { "id": "01M6JQPCFGW7EM3S59E2BAASGZ", "packId": "vos-1903-kingdom-en", "language": "en", "kind": "source",
        "sections": 11, "paragraphs": 131, "licence": "public-domain", "revision": 3, "version": "1.0.0", "partial": false },
      { "id": "01M6K66F2C06J665YYB3AR377H", "packId": "vos-1903-kingdom-ro", "language": "ro", "kind": "translation",
        "sourceEditionId": "01M6JQPCFGW7EM3S59E2BAASGZ", "sections": 1, "paragraphs": 8, "licence": "licensed",
        "revision": 2, "version": "1.0.0", "partial": true, "sourceSections": 11 }
    ]
  }],
  "totals": { "works": 1, "editions": 2, "packs": 2, "paragraphs": 139 },
  "languages": ["en", "ro"]
}
```

`partial: true` marks a translation that covers fewer sections than its source (a translation in
progress). It is cached for 5 minutes (`Cache-Control: public, max-age=300`).

## How an answer is made

1. **Packs.** At startup every folder of `PACKS_DIR` (`manifest.json` + `pack.json`) is verified
   byte for byte with `verifyPackBytes` (`packages/content-tools/src/signing.ts`, the function the
   `verify-pack` CLI uses): schema, size, sha256, canonical form, identity, and the Ed25519
   signature against the public keys pinned in `KEYS_DIR` (`content/keys/*.pub`, the files the app's
   `trusted-keys.ts` mirrors). **A pack that fails is never indexed**; the reason is logged
   (`pack.rejected`) and counted in `rejectedPacks`. One pack per edition (the higher revision wins).
   Packs are read once at start: a new pack means a new deploy (the workflow does it when a pack
   changes).
2. **Index.** Paragraphs are indexed per language with BM25 over tokens folded like the app's search
   (lower case, diacritics removed), Romanian and English stop-word lists, and a light suffix
   stemmer (`kingdoms` = `kingdom`; `împărăția`, `împărăției`, `împărăție` meet). Two paragraphs
   that render one another (`sourceId`) form one **passage** and count once. The analysed terms of
   every paragraph are also kept in memory as integer ids (the phrase check below reads them), so
   answering a question never analyses paragraph text again: retrieval takes about a millisecond.
3. **Retrieval.** BM25 per language. The question is searched as asked in the index of its own
   language; for every other installed language it is first **rendered in that language's
   vocabulary** with a small Romanian-English theological glossary (about 280 concepts,
   `src/text/glossary.ts`): the question's filler words are dropped, the words the glossary knows
   are replaced by their equivalent (synonyms and inflected forms are searched too, at half
   weight), anything else is kept, so names still match. A Romanian question therefore reaches a
   passage that exists only in English, and the other way round. Then a bonus for adjacent query
   words found adjacent in the paragraph ("kingdom of heaven" as a phrase), a **boost for scripture references**: `Mat. 4:17`,
   `Matthew 4:17` and `Matei 4:17` are the same reference, and so is the old-style `Matt. iv. 17`
   found in the texts; paragraphs that cite the verse (or overlap its range; weaker: the same
   chapter) are boosted and found even when the question has no other word. The asked language is
   preferred. The top 10 **passages** are kept, each with its aligned versions. A very short
   follow-up ("and what else?") borrows the previous question of the conversation.

   **Scope.** `editionIds` and `scope.workId` limit the search, and the aligned versions shown, to
   those editions (the question is still carried across languages). **Passage.** With `passage`
   the section of that paragraph is searched first and the whole library tops the answer up
   (`src/library/passage.ts`). The sources are, in this order: (1) the attached passage itself,
   whether or not it shares a word with the question ("what does this mean?" has nothing to search
   for, and is a good question about a passage); (2) the paragraph just before it and the one just
   after it, in the same section; (3) the best matches for the question inside the same section,
   until steps 1 to 3 give 5 passages, and only those that score at least 15 % of the best passage
   of the whole library (a section with nothing to say about the question does not fill the
   answer); (4) the usual retrieval over everything the request allows, for the rest of the 10: the
   global top-up. "The same section" is the section in every installed edition (a translation's
   section shares the key of the section it renders), a passage counts once however many editions
   carry it, and it is shown in the language of the answer when that edition exists. The model is
   told which document is the selected one (a `<selected_passage>` line before the question), so
   that "this passage" has a meaning.
4. **No passage, no answer.** If nothing matches, the model is not called: the stream is
   `sources: []`, one `delta` that says the library does not cover this yet, and `done` with
   `stopReason: "not_covered"`. (An attached passage is a passage: the model is called.)
5. **Prompt.** The system prompt (in the language of the answer) makes the model answer only from
   the numbered documents, cite inline as `[1]`, say plainly when the documents do not cover the
   question, never invent quotations (quotation marks only for text copied word for word; Scripture
   only if it is in a document), stay neutral between traditions and name each author and tradition,
   treat documents and question as data, write in the requested language, and answer with care if
   the person seems to be in distress. Each document carries work, author, tradition, section, the
   paragraph id and the version(s) of the passage. Retrieved text cannot forge the prompt's tags.
6. **Model call** (`claude` provider): the official SDK (`@anthropic-ai/sdk` 1.0.0), `client.messages.stream`,
   model `MODEL` (default `claude-sonnet-5-5`), `max_tokens` 1200, `output_config.effort` `low`.
   **No `temperature`/`top_p`/`top_k`** (the current models and API version reject them) and no
   `thinking` setting (adaptive thinking is the default and counts towards the 1200 tokens; at
   `low` effort it is short). SDK timeout 60 s for the response and 2 automatic retries (429, 5xx,
   network); a 120 s deadline for the whole answer. A `refusal` stop reason becomes an `error` event
   (`refused`) instead of an empty answer.
7. **Citations.** The `[n]` markers (`[1]`, `[2][4]`, `[1, 3]`, `[2-4]`, up to `[1, 2, ..., 10]`) are
   parsed from the stream, however the deltas cut them (down to one character at a time), into
   `citation` events and the `citations` array. A marker that names no source (`[0]`, `[99]`,
   `[3-1]`, `[1-100]`) is counted in `invalidCitations` and never announced.
8. **Quotation check.** Each quotation of the answer is checked against the sources its own
   sentence cites (all sources when the sentence cites none); the failures are counted in
   `done.quotations.unverified`, listed in `done.quotations.unverifiedItems` with their sentence,
   and logged by count only (never the text). See `done` above for the exact rules.
9. **Usage** is recorded in the `ask.completed` log line (and in a running total printed at
   shutdown).

The **mock provider** (`AI_PROVIDER=mock`) goes through exactly the same pipeline, but its answer is
fixed text that quotes and cites the first two sources, streamed in 7-character pieces so that
citation markers are split across deltas. Use it for app development and the smoke test.

Limits of retrieval in this version: it is lexical. A Romanian question finds the translated parts
of a book in Romanian (today: chapter I of Vos) and, through the glossary, the rest of it in
English: "Cum se leagă Împărăția de Biserică?" is searched as "kingdom church" and finds chapter IX
("The Kingdom and the Church"), "De ce sunt necesare pocăința și credința?" finds chapter X
("Repentance and Faith"), "Este Împărăția prezentă sau viitoare?" finds chapter IV. The glossary
covers the words it lists (the vocabulary of the book and of common theological questions), not
the language: a question made of words it does not know is searched as it is, and a Romanian noun
followed by its adjective ("Duhul Sfânt") is rendered in the Romanian order. It is a bridge until
the translations are complete and the hybrid (vector) search, or a Haiku query translation, takes
over (see below). English questions find all of the English text and, through the same table, the
Romanian one.

## Configuration

All settings come from the environment and are validated at startup (zod); a mistake stops the
process with every problem listed, never printing a secret. Empty variables count as unset.
`apps/api/.env.example` is the annotated list.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | Port to listen on (`0` = any free port). |
| `LISTEN_HOST` | `0.0.0.0` | Interface to bind. |
| `NODE_ENV` | `development` | `development`, `test` or `production`. |
| `AI_PROVIDER` | `mock` | `mock` or `claude`. |
| `ANTHROPIC_API_KEY` | none | Required when `AI_PROVIDER=claude`. Environment only; on Fly a secret. |
| `ANTHROPIC_BASE_URL` | Anthropic API | Only for a proxy or a stand-in server. |
| `MODEL` | `claude-sonnet-5-5` | Model id. (`claude-haiku-5-5` is the cheap choice for a free tier.) |
| `MAX_OUTPUT_TOKENS` | `1200` | Output limit of one answer (thinking counts towards it). |
| `MODEL_EFFORT` | `low` | `output_config.effort`: `low`, `medium`, `high`, `xhigh`, `max`, or `none` to leave it out (models that do not take it). |
| `MODEL_FALLBACK` | `off` | `default` asks for the API's server-side refusal fallback (beta header `server-side-fallback-2026-07-01`). |
| `PROVIDER_TIMEOUT_MS` | `60000` | Wait for the model's response headers. |
| `PROVIDER_MAX_RETRIES` | `2` | SDK retries (429, 5xx, network). |
| `ASK_DEADLINE_MS` | `120000` | Overall limit of one answer; then an `error` event `timeout`. |
| `PACKS_DIR` | `<repo>/apps/mobile/assets/packs` | Folder of signed packs. The image uses `/app/packs`. |
| `KEYS_DIR` | `<repo>/content/keys` | Folder of the pinned `*.pub` keys. The image uses `/app/keys`. |
| `ALLOWED_ORIGINS` | `https://deiuvrg.github.io,http://localhost:8081,http://127.0.0.1:8081` | CORS allow-list (origins only, no wildcard). |
| `RATE_LIMIT_MAX` | `20` | Questions per window per client. |
| `RATE_LIMIT_WINDOW_SECONDS` | `600` | The window: 20 per 10 minutes by default. |
| `RATE_LIMIT_READ_MAX` | `120` | Requests to `/`, `/v1/health`, `/v1/library` per window per client. |
| `RATE_LIMIT_READ_WINDOW_SECONDS` | `60` | The window of the read limit. |
| `TRUST_PROXY` | `none` | How to find the client address: `none` (socket), `fly` (`Fly-Client-IP`), `xff` (last `X-Forwarded-For` entry). A forwarded value that is not an IP address is ignored and the socket address is used. The Docker image leaves it at `none`; only `fly.toml` sets `fly`. |
| `ACCESS_CODE` | none (open beta) | The tester access code(s) of the closed beta: one, or several separated by commas, each 1 to 128 visible ASCII characters without spaces. Set, `POST /v1/ask` needs the header `X-Access-Code` with one of them, otherwise `401 access_required`. A value that lists no code (only commas) is a start-up error (a typo must not open the beta). An empty value counts as unset, like every empty variable, so it opens the beta; start-up then logs `access.open` as a warning (`blank: true`), and also as a warning whenever the model behind an open beta is the real one (`info` for the mock). **A secret**: environment only, on Fly `fly secrets set`. Codes under 12 characters are accepted but reported at start-up (`access.weak_codes`, a count only). |
| `ACCESS_FAILURE_MAX` | `20` | Wrong access codes one client address may present per window before it is locked out (1 to 100,000; a client is counted like the question limiter counts it, IPv6 by /64). Only a code that is present and wrong counts: a missing one costs nothing. Set it high to switch the lockout off in practice, for example for testers who share one address. |
| `ACCESS_FAILURE_WINDOW_SECONDS` | `600` | The window of the lockout, in seconds (1 to 86,400). It is a token bucket: 20 per 600 s is a burst of 20 wrong codes, then one more attempt every 30 seconds. |
| `DAILY_QUESTION_CAP` | `0` (off) | Questions answered per UTC day, all clients together (0 to 1,000,000). Above it `POST /v1/ask` answers `503 provider_busy` with `Retry-After` until midnight UTC. In memory: see [Limits](#limits-privacy-and-security). |
| `MAX_BODY_BYTES` | `65536` | Largest request body. |
| `REQUEST_TIMEOUT_MS` | `15000` | Time a client gets to send a whole request (headers and body). A slower sender is cut off with `408`; the answer that streams back is not affected. |
| `HEADERS_TIMEOUT_MS` | `10000` | Time a client gets to send the request headers (must not exceed `REQUEST_TIMEOUT_MS`). |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent`. |
| `LOG_HASH_SALT` | random per process | Salt (8+ characters) for the hashes in logs. |
| `SHUTDOWN_GRACE_MS` | `20000` | On SIGTERM, running answers get this long to finish. |

## Limits, privacy and security

- **The access code** (`ACCESS_CODE`): while the beta is closed, `POST /v1/ask` needs the header
  `X-Access-Code` with one of the configured codes and answers `401 access_required` without it.
  The check runs first: before the shutdown and library checks, before the rate limiter (a request
  without the code takes no token and shows no `RateLimit-*` headers), before the body is read and
  before any model call. `GET /`, `GET /v1/health`, `GET /v1/library` and CORS preflights stay open
  (the preflight allows the header: `Access-Control-Allow-Headers: Content-Type, X-Access-Code`).
  The codes are kept as SHA-256 digests and the presented code is compared with every one of them
  using `timingSafeEqual`, with no early exit. A code is never logged: the log says only
  `access.denied` with `reason` `missing` or `invalid`, and `accessCodeCount` in the configuration.
  **Wrong codes are throttled per client** by a bucket of their own (`ACCESS_FAILURE_MAX` per
  `ACCESS_FAILURE_WINDOW_SECONDS`, 20 per 10 minutes by default), never by a token of the question
  limiter: only a code that is present and wrong uses up an attempt (a missing one is a first visit
  and costs nothing, a right one is never charged, and it does not clear earlier failures either, so
  a tester cannot use their own code to keep guessing at the others). A client that has run out is
  refused with `429 rate_limited` and `Retry-After` **before its code is looked at, even a right one**,
  so a guesser cannot tell a hit from a miss while it waits; the lockout ends as the allowance
  refills. The price is that people behind one address share the allowance (a class on one router):
  raise `ACCESS_FAILURE_MAX` for them. The address must be the real one (`TRUST_PROXY`, see "Client
  address" below): behind a proxy that is not understood, every tester has the proxy's address and
  one guesser would lock them all out. This slows a guesser from line speed (thousands of tries per
  second were measured on loopback) to about 2,900 a day per address at the defaults; it does not
  stop many addresses, so **use a long random code** (`openssl rand -base64 18`); short ones are
  reported at start-up. The log keeps pace: one `access.denied` line per wrong code (so at most the allowance per
  window and client), one `access.locked` line when a client runs out, and a missing code is only a
  debug line, the `request` line already records the 401. The code is the gate of a closed beta, not
  an account: everyone who has it shares it, and several codes can be valid at once, to rotate one
  without a gap. If `ACCESS_CODE` is not set, or is empty, the beta is open: start-up logs
  `access.open` (a warning when the value was empty or the model is the real one) so that this is
  never silent.
- **The daily question cap** (`DAILY_QUESTION_CAP`): at most that many questions are answered per UTC
  day, all clients together, so that the spend limit of the model account is not the only brake. A
  question takes a slot after it has passed every check above (a request refused earlier costs
  nothing) and before the model is called, so questions that arrive together cannot all slip under
  the cap. A question that ends without a model call because nothing in the library matched
  (`not_covered`) gives its slot back; one that fails or is cut off counts, because the call was
  made. The mock provider counts too. Above the cap: `503 provider_busy` with `Retry-After` (and
  `error.retryAfterSeconds`) until midnight UTC, as an HTTP error before any stream starts. Every
  change of the count is logged (`daily_cap.count`, `daily_cap.reached`, `daily_cap.refused`,
  `daily_cap.reset`). **The count is in memory**, like the rate limiter's: it belongs to one
  machine and starts from zero when the process restarts. On Fly the machine stops when idle and
  starts on the next request (`auto_stop_machines`), so until the count moves to shared storage
  (Supabase, P2) the cap holds for one run of the machine, not for the calendar day; keep the
  machine running (`min_machines_running = 1`) if a hard daily bound matters, and keep the spend
  limit of the model account as the real protection.
- **Rate limit**: a token bucket per client address, default **20 questions per 10 minutes** (a burst
  of 20, then one more every 30 seconds). Every `POST /v1/ask` counts, valid or not, but a request
  that is refused with 429 costs nothing more. IPv6 clients are counted by /64. Read endpoints have
  their own, larger bucket. State is in memory, per machine: run **one machine** until the limiter
  moves to shared storage.
- **Client address**: with `TRUST_PROXY=none` (the default, and what the Docker image uses) the
  socket address is used and forwarding headers are ignored (they are client-controlled). Behind
  Fly use `fly`, which `fly.toml` sets and the image does not: anywhere that is not Fly's proxy
  would believe a forged `Fly-Client-IP` and the per-address limit could be dodged by changing it.
  A forwarded value that is not an IP address (in `fly` and `xff` mode) is ignored and the socket
  address is used, so garbage can neither mint rate-limit keys nor grow the limiter's table.
- **Request limits**: 64 KiB body, JSON only (`415` otherwise, which also forces a CORS preflight for
  cross-site pages), **15 s to send a whole request and 10 s for its headers**
  (`REQUEST_TIMEOUT_MS`, `HEADERS_TIMEOUT_MS`: a slower sender gets `408` and loses the connection, so
  half-sent questions cannot hold the machine's request slots; the streamed answer is not covered),
  question 2000 characters, 6 turns of history, 120 s per answer, 1200 output tokens.
- **CORS**: an explicit allow-list (`ALLOWED_ORIGINS`) and an explicit header list
  (`Access-Control-Allow-Headers: Content-Type, X-Access-Code`); other origins get no
  `Access-Control-*` headers and a `403` preflight. The `401` of a missing code carries the CORS
  headers of an allowed origin, so that the page can read it and ask for the code. `Vary: Origin` is on every response, also when the request names no
  origin, because the library listing is publicly cacheable.
- **Security headers** on every response: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, a `default-src 'none'` CSP, HSTS, `Permissions-Policy`, and
  `Cache-Control: no-store` (except the library listing, and the answer stream, which is
  `no-cache, no-transform`).
- **Logs** are JSON, one object per line, on stdout. **The text of a question or answer is never
  logged, at any level**: only a keyed hash of the question (`questionHash`), its length, and a hash
  of the client address (`client`). Per answer there is one `ask.completed` line with language,
  provider, model, number of sources, timings (retrieval, first token, total), token usage,
  citations, quotation counts and the stop reason. The configuration is logged without secrets
  (`ANTHROPIC_BASE_URL` without user info, query or fragment; a URL with credentials is refused at
  start-up). A failed model call is logged as facts only: the class of the SDK error, the HTTP
  status, the error type and Anthropic's request id, plus the classified code. **Never the message,
  the stack or the body of the upstream response**: the SDK builds its message from the body, and a
  proxy or stand-in server (`ANTHROPIC_BASE_URL`) can put anything in it, a copy of the request or
  of the key included.
- **Secrets**: the secrets are `ANTHROPIC_API_KEY` and `ACCESS_CODE`, read from the environment.
  Neither is in the repository, the image, `fly.toml` or any log (tests check this).
- **Prompt injection**: documents come from verified packs, and neither their text nor the question
  nor the earlier turns can forge the prompt's tags: every `<` (also the fullwidth and small forms)
  becomes `‹`, whatever the spelling of the tag (`< /question>`, zero-width characters, other case),
  and the language of an edition is reduced to letters, digits and hyphens before it is placed in
  an attribute. The model is told to treat documents and question as data. There are no tools.
  One risk is accepted: the earlier turns of a conversation come from the client (the API keeps no
  state), so a client can forge `assistant` turns; they give it no authority it does not already
  have over its own question.
- **Shutdown**: on SIGTERM/SIGINT the listening socket is closed at once (new connections are
  refused, and Fly stops routing to the machine); a request that still reaches the process in that
  instant gets `503 shutting_down` and `/v1/health` reports `ok: false`; answers in flight finish
  (up to `SHUTDOWN_GRACE_MS`), the rest end with an `error` event `shutting_down`, and the totals of
  model usage are logged.

## Suggestions and evaluation set v0

Both live in `content/ask/` (outside the service: the image does not carry them; the app bundles the
suggestions, the tests and the `eval` script read them in a checkout).

**Suggestions.** `suggestions.ro.json` and `suggestions.en.json` hold the prompts of the Ask welcome
screen (`docs/ui-spec-v2.md` 9.3): a JSON array of 8 objects per language, the same ids, groups and
scopes in both files, in the same order.

```json
{ "id": "kingdom-church", "group": "doctrine", "text": "How does the kingdom of God relate to the church?", "scope": "library" }
```

- `id`: stable, shared by the two languages. `group`: `doctrine`, `idea` or `passage`, the three
  groups of the welcome screen (two prompts at least in each, so that "one random prompt, never the
  one shown before" has something to choose from). `text`: the question, which a click puts in the
  composer and never sends. `scope`: `"library"` or `{ "workId": "<id>" }`, the scope chip the
  prompt asks for (`{ workId }` is sent as the request's `scope`).
- The 8 subjects over the installed work (Vos): the kingdom of God and the church, the present and
  the future kingdom, righteousness, repentance and faith, the Old Testament background, John and the
  Synoptics, the Sermon on the Mount, the parables. The owner approves the texts (roadmap P1-G1).
- `apps/api/src/suggestions.test.ts` sends every suggestion through the gateway with the mock
  provider (`?stream=false`, in its own language, with its scope) and fails unless the answer has
  sources from the expected work, in the chapters that answer it, with a citation and no unverified
  quotation. A suggestion the library cannot answer is a broken promise: add a prompt to the files
  and to the table of expected subjects in that test, and it is held to the same standard.

**Evaluation set v0.** `eval-v0.json` has 40 questions, 20 Romanian and 20 English, over the
installed work: 14 subjects asked in both languages (so that the gap between them can be measured)
and 6 more in each language (scripture references in both notations, a question without a single
place in the book, the conclusion of the book). Each question has `expectedWorkIds` and, where one
place answers it, `expectedSectionOrdinals`: the 0-based ordinals of the sections of the source
edition (0 is chapter I, 10 is chapter XI), chosen from the book and not from what retrieval returns.

`pnpm --filter @biblioteca/api eval` (`apps/api/src/eval/run-eval.ts`) runs every question through
the real pipeline with the **mock provider**, prints the checks below and writes
`content/ask/eval-v0.report.json`. The report has no timestamps, request ids or scores, and the mock
provider is deterministic, so the same questions on the same packs give the same file byte for
byte: a change in the report is a change in retrieval or in the content, and the report records the
hash of the question file and the id, revision and hash of every pack it was made on. `--check`
compares a fresh run with the committed report (exit 1 if they differ), `--no-write` only prints.
The exit code is 1 when a gate fails. The unit tests (`eval/eval.test.ts`) check the set against the
library, the arithmetic, the determinism, that the report matches the question file, and that it
equals a fresh run as long as the packs are the ones it was made on (when a translation grows, the
test only warns that the report is stale, so that the content work is never blocked by it).

What the mock provider can and cannot show: it quotes and cites the first two sources word for word,
so "sources present", "valid citation", "markers in range" and "quotations verified" hold by
construction and fail only if the pipeline breaks; the rates that measure something are the
expected work and expected section ones, which are retrieval. The gates of `docs/roadmap-v2.md`
3.3 for the real model (90 % of answers with a valid citation, 95 % without an unverified quotation)
need `AI_PROVIDER=claude` and a key, and are not measured here. The three gates this run enforces
are `sourcesPresent` 100 %, `withCitation` 90 % and `quotationsVerified` 95 %; retrieval quality is
reported and not gated, so that the gaps stay visible.

Result on the installed packs (Vos, English revision 3 and Romanian revision 2, 139 paragraphs; the
Romanian edition covers chapter I only, so the other chapters are reached in English through the
glossary):

| | all | Romanian | English |
| --- | --- | --- | --- |
| questions | 40 | 20 | 20 |
| sources present | 40/40 | 20/20 | 20/20 |
| with a valid citation | 40/40 | 20/20 | 20/20 |
| every marker names a source | 40/40 | 20/20 | 20/20 |
| quotations verified | 40/40 | 20/20 | 20/20 |
| expected work among the sources | 40/40 | 20/20 | 20/20 |
| expected section among the 10 sources | 38/39 (97.4 %) | 19/20 (95.0 %) | 19/19 (100 %) |
| expected section among the first 3 | 35/39 (89.7 %) | 17/20 (85.0 %) | 18/19 (94.7 %) |
| mean reciprocal rank of the first expected section | 0.798 | 0.760 | 0.838 |

Of the 14 subjects asked in both languages, both languages reach their section in 14. The one
question that reaches no expected section is `ro-19` ("Care este concluzia cărții despre
Împărăția?", chapter XI, the recapitulation): a lexical search has no way to find "the conclusion of
the book", and its English counterpart has no expected section for the same reason. Read the numbers
as a baseline for the hybrid retrieval and for the cross-language work of roadmap P1-B4, not as a
quality bar: 39 questions on one book of 11 chapters, with expected sections that are often several
chapters wide, are easy to satisfy; the first-three rate and the reciprocal rank are the ones that
will move.

## Deploying to Fly.io (steps for the owner)

You need a Fly.io account, `flyctl` (`brew install flyctl` or `curl -L https://fly.io/install.sh | sh`)
and an Anthropic API key. Run the commands from the **repository root**.

1. **Log in and create the app** (the name in `apps/api/fly.toml` is `biblioteca-api`; Fly app names
   are global, so if it is taken pick another and change `app` there and `--app` below and in
   `.github/workflows/api-deploy.yml`):
   ```bash
   fly auth login
   fly apps create biblioteca-api
   ```
2. **Set the model key as a Fly secret** (never in git, never as a GitHub secret). Use a key from a
   dedicated Anthropic workspace with a spend limit (see Costs):
   ```bash
   fly secrets set ANTHROPIC_API_KEY=... --app biblioteca-api
   ```
   For the closed beta set the tester code the same way (a long random value; several codes
   separated by commas work too). Without it the gateway answers anyone who finds the URL, and so
   it does with an empty one (a secret that was set to nothing); `fly logs` shows an `access.open`
   warning at start-up in both cases:
   ```bash
   fly secrets set ACCESS_CODE="$(openssl rand -base64 18)" --app biblioteca-api
   ```
   The daily cap is an ordinary setting: a line such as `DAILY_QUESTION_CAP = "200"` in `[env]` of
   `fly.toml` (see [Limits](#limits-privacy-and-security) for what it can and cannot promise).
3. **First deploy, by hand, on one machine** (the in-memory rate limit needs one):
   ```bash
   fly deploy --config apps/api/fly.toml --remote-only --ha=false
   ```
   It builds `apps/api/Dockerfile` on Fly's builder with the repository root as context
   (`apps/api/.dockerignore` keeps the private signing key, `node_modules` and the rest out), starts
   the machine in `fra`, and waits for `GET /v1/health`.
4. **Check it**:
   ```bash
   curl https://biblioteca-api.fly.dev/v1/health
   curl -sN https://biblioteca-api.fly.dev/v1/ask -H 'content-type: application/json' \
     -H 'X-Access-Code: <the code>' \
     -d '{"question":"What is the kingdom of heaven?","language":"en"}'
   # Without the header the answer is 401 access_required:
   curl -s https://biblioteca-api.fly.dev/v1/ask -H 'content-type: application/json' \
     -d '{"question":"What is the kingdom of heaven?","language":"en"}'
   fly logs --app biblioteca-api
   ```
5. **Let GitHub deploy from now on**: create a deploy token limited to this app and add it to the
   repository as an Actions secret named **`FLY_API_TOKEN`** (Settings, Secrets and variables,
   Actions, New repository secret):
   ```bash
   fly tokens create deploy --app biblioteca-api
   ```
   `.github/workflows/api-deploy.yml` then runs on pushes to `main` that touch `apps/api/**`, the
   packs (`apps/mobile/assets/packs/**`), `content/keys/**`, `packages/shared/**`, the signing
   module or the lockfile: it type-checks, lints and tests the API, builds the image and
   smoke-tests it in mock mode, and only then runs `flyctl deploy`. Pull requests run the checks
   and the image build but never deploy. **Without the secret the deploy job is skipped, not
   failed.** The Fly action is pinned to a commit SHA (and `flyctl` to a version); Dependabot
   updates the action.
6. **Point the app at it** with a public variable (it is a URL, not a secret), for example
   `EXPO_PUBLIC_ASK_API_URL=https://biblioteca-api.fly.dev`, and make sure the app's origin is in
   `ALLOWED_ORIGINS` (`https://deiuvrg.github.io` is there; change it in `apps/api/fly.toml` for a
   custom domain).

Memory: the bundled server idles at about 105 MB (measured on Node 22; the image does not set
`NODE_OPTIONS=--enable-source-maps`, which adds 30 to 40 MB and can be switched on for one run when a
readable stack trace is needed, `dist/server.js.map` is shipped for that), and the index of the two
Vos packs adds well under 1 MB, so 256 MB is plenty for a handful of books. Budget roughly 10 to 15 times the size of
`pack.json` in RAM and raise `memory` in `fly.toml` as the library grows (the hybrid search will
move the index out of the process).

Day to day: `fly status`, `fly logs`, `fly releases`; roll back by deploying an earlier image
(`fly deploy --image <ref from fly releases --image>`). The machine stops when idle and starts on the
next request (a couple of seconds of cold start; packs are verified and indexed in well under a
second). To change a setting: edit `[env]` in `fly.toml` and deploy, or `fly secrets set` for the key.

New or re-signed packs: commit them under `apps/mobile/assets/packs`; the workflow redeploys, and the
service refuses any pack that does not verify against `content/keys/*.pub` (the same keys the app
pins). When the signing key is rotated, update `content/keys/*.pub` and the app's `trusted-keys.ts`
together.

## Costs and spend limits

Per question, the model sees the system prompt (about 800 tokens), up to 10 passages (a Vos
paragraph is about 300 tokens; a translated one is sent with its original) and the last turns:
typically **2,000 to 5,000 input tokens and 100 to 600 output tokens**. At Sonnet 5.5 prices
($2 / $10 per million tokens, November 2026) that is roughly **0.005 to 0.015 USD per question**; a
free tier on `claude-haiku-5-5` costs about a tenth of that. With the default limit of 20 questions
per 10 minutes (120 an hour) one address that never pauses typically costs 0.6 to 1.8 USD per
hour. That is not an upper bound: a request can be larger (six 8,000-character turns of history,
ten long passages and 1,200 output tokens come to about 19,000 input tokens, about 0.05 USD per
question, roughly 6 USD per hour for one address, 7 in the first hour with the burst). Addresses
are free to multiply as well, so **the real protection is a spend limit**: create a dedicated Anthropic workspace for
the gateway, put the key of that workspace in the Fly secret, and set a monthly spend limit and an
alert in the Console. The `ask.completed` log lines carry the token counts for a cost report.
Prompt caching is not used yet (the prefix that repeats is only the system prompt).

Two brakes come before the spend limit. The access code keeps the gateway to the testers who have
it. The daily cap bounds the day: at the sizes above, a cap of 200 questions is about 1 to 3 USD a
day, and about 10 USD if every question were the largest possible. It counts in memory, so it
holds per run of the machine (see Limits); the spend limit stays the real protection.

## What is deferred

Decided in `docs/arhitectura-app-biblica.md` and not part of this slice:

- **Accounts and consent**: Supabase Auth (JWT verified with JWKS), the AI consent version check
  (403 before any provider call), conversations and messages in Postgres, per-user budgets in money,
  free/member tiers, the global kill switch for the free tier.
- **Hybrid retrieval**: embeddings (voyage-4, `halfvec(1024)`), HNSW + lexical + RRF in Postgres,
  chunking with context prefixes, a reranker if recall needs it. This is also what replaces the
  glossary that carries a question across languages today (it knows only the words it lists); a
  `claude-haiku-5-5` query translation is the cheaper step in between.
- **Citations API and "ask this book"**: whole-edition `document` blocks with `cited_text`
  verification (mode A), and "ask about this passage" (mode C) with the verse text from licensed
  Bible translations. Here citations are `[n]` markers parsed from the text, and quotations are
  checked after the fact.
- **Prompt and answer caching** (prefix cache for the system prompt and the documents, identical
  answers for the free tier), and the **Haiku classifier** (on-topic, injection, crisis, contested).
- **Evaluation with the real model**: the set v0 and its structural run exist (above); what is
  still to do is the run with `AI_PROVIDER=claude` against the thresholds of roadmap 3.3, recall
  against a judged set, grounding, and the nightly canary.
- **Process split and edge**: the `gateway`/`ops` groups with separate secrets, Cloudflare Tunnel
  and WAF, a shared rate limiter for more than one machine, Sentry and uptime monitoring.
- **Reload without a deploy**: packs are read at start.

## What the app has to pick up

The screens were specified (`docs/ui-spec-v2.md` 9.5, 9.8 and 9.11, check A22) before the gateway work
of P1-B2 and P1-B3, and the gateway now does a little more than they describe. Until the spec is
brought up to date these are the differences (each is defined where this document says so):

| The gateway | The screen spec says | The app should |
| --- | --- | --- |
| `error.requestId` is inside the error object and in the SSE `error` event; `retryAfterSeconds` is also in non-streaming JSON errors ([Endpoint contract](#endpoint-contract)) | 9.11: `error { code, message, retryAfterSeconds? }` | Read the id for the "Detalii" disclosure. |
| `400 unknown_passage` ([Other status codes](#other-status-codes)) | 9.8 has no row for it, so it would show the generic "Ceva nu a mers" | Ask again without `passage`. |
| `done.quotations` has `uncited` and `unverifiedItems` (`{ text, sentence, offset, cited }`) next to the number `unverified` | 9.5 item 9 and 9.11: `{ checked, unverified }` | List the strings of `unverifiedItems`; keep reading `unverified` as a number. |
| `503 provider_busy` with a long wait, which is the daily cap (see "Telling the daily cap from a busy model") | 9.8: "try again in a few seconds" with "Reia întrebarea" | Show the wait and `error.message`; no immediate retry above a minute. |
| `429 rate_limited` for too many wrong access codes | 9.8: "Ai pus multe întrebări într-un timp scurt" | The countdown fits; the copy can name the code, as `error.message` does. |
| With a `passage` the sources are not sorted by score: the attached passage is source `[1]`, the passages around it have `score` 0 | 9.5 | Keep the order of `sources`; do not sort by score. |
| `passage: { editionId, paragraphId }` and `scope: { workId }` are request fields | 9.11 and A22: until a `passage` field exists the passage is sent inside the question as quoted text | Send the fields, and the question as typed. |

## Decisions and deviations

Notes for `docs/decizii.md` (a project rule: every deviation from the architecture document is
written down there with its reason). The first block is the P1-B2 and P1-B3 addendum of
4 November 2026 (also written in `docs/decizii.md`, under ADR-015); the rest is the first slice.

- **A closed beta by access code, ahead of accounts** (architecture 7 asks for the DPIA before AI
  reaches a preview, and for accounts after it). `ACCESS_CODE` is checked before anything else on
  `POST /v1/ask`, so that a request without the code costs no rate-limit token and no model call.
  Wrong codes were first left unthrottled (the answer was a long random code, with a start-up
  warning for short ones, and not a second limiter, which the roadmap did not ask for). The review
  of the same day measured 2,200 guesses a second against it and that choice was reversed: wrong
  codes now use up an allowance of their own per client (`ACCESS_FAILURE_MAX` per
  `ACCESS_FAILURE_WINDOW_SECONDS`) and a client that has run out is refused with `429` before its
  code is looked at. It is a second in-memory limiter, so like the first it holds per machine; its
  price (people behind one address share the allowance) is why the numbers are settings. An
  `ACCESS_CODE` that is set but empty still opens the beta (an empty variable is an unset one), but
  start-up now says so (`access.open`) instead of leaving it to a count in the configuration line.
- **A global daily cap, in memory.** `DAILY_QUESTION_CAP` counts the questions that reach the answer
  pipeline (the mock provider included) and gives back the ones that never called the model. It is
  per process: Fly stops an idle machine and the count starts again, so the cap bounds a run of the
  machine, not the calendar day, until it moves to shared storage in P2. Written down because the
  roadmap sold it as a brake "so the spend limit is not the only one", and it is a weaker brake than
  it looks on a machine that sleeps.
- **`scope` and `passage` are fields of the request, not new endpoints.** An unknown work in
  `scope` reuses `unknown_editions` (the app already shows "the scope you chose no longer exists");
  an unknown or unusable `passage` is a new `400 unknown_passage` and not a silent fallback to the
  whole library, because a client that sends a wrong paragraph id has a bug to find, and the app
  can retry without `passage` on that code. With a `passage` the sources are no longer sorted by
  score (the attached passage is `[1]`).
- **The model is told which document is the selected passage** (a `<selected_passage>` line before
  the question). This goes beyond "scope retrieval to the section": without it "what does this mean?"
  has no subject. It is sent only with a `passage`, so every other prompt is unchanged.
- **The request id is inside the error object** (`error.requestId`, and in the SSE `error` event),
  not beside it, and `retryAfterSeconds` is now in the JSON body of a non-streaming failure too.
- **`quotations.unverified` stays a number.** The roadmap and the screen spec ask for "the
  unverified strings in `done`"; the screen spec also tests `quotations.unverified > 0`, which an
  array would silently turn false (`[x] > 0` is false in JavaScript). The strings, the sentence
  index and the position are therefore in the new `unverifiedItems`, and `uncited` says how many
  quotations had no citing sentence and were checked against all sources, so that the copy
  "checked against the cited sources" stays true. The check itself is stricter than before: a
  quotation that is in the sources but not in the one its sentence cites is now unverified.
- **The evaluation runs on the mock provider only**, as asked; the real-model gates need a key. The
  retrieval rates are reported and not gated, so that the gaps stay visible for roadmap P1-B4.

- **One service now, not two groups.** `gateway` and `ops` are one process while there are no
  payments or publishing; the Ask code does not depend on that and can move.
- **Packs from disk, not Postgres.** Retrieval runs over the signed packs the app ships, verified at
  start. The `content` schema and `hybrid_search` replace this when Supabase is live.
- **Bundled with esbuild, type-checked with `tsc`.** `@biblioteca/shared` and `@biblioteca/content-tools`
  are TypeScript sources that Node cannot load as they are (extensionless imports), so `pnpm build`
  runs `tsc --noEmit` and then bundles `src/server.ts` into one `dist/server.js`; the Docker image
  has no `node_modules`.
- **`verifyPackBytes` lives in `@biblioteca/content-tools`**, not in `@biblioteca/shared`; the API
  depends on that package for it (one verifier for the CLI and the service).
- **SDK 1.0.0** (`@anthropic-ai/sdk`, API version 2026-10-21, the first release older than two
  weeks that sends it): no sampling parameters, `Authorization: Bearer` key. 1.1.0 was published
  less than two weeks ago.
- **Refusal fallback is opt-in** (`MODEL_FALLBACK=default`). The current guidance for
  `claude-sonnet-5-5` is to enable the server-side fallback by default and to tell the owner; it is
  kept off here, on purpose, until the owner has confirmed that the organisation has the beta:
  it needs the beta endpoint and the header `server-side-fallback-2026-07-01`, and an organisation
  without it would get a 400 for every request, which cannot be tested offline. Its value is small
  for this library as well: on Sonnet it retries only `cyber` and `frontier_llm` refusals, which a
  theology library hardly meets. Refusals are handled either way (an `error` event, never an empty
  answer). To switch it on: confirm the beta in the Console, set `MODEL_FALLBACK = "default"` in
  `[env]` of `fly.toml`, deploy, and ask one question (`done.model` names the model that answered).
- **`id` of a source is the passage id**, shared by all language versions, with the versions in
  `aligned`, instead of one flat entry per language. Citation numbers therefore count passages.
- **Environment names**: `MODEL_EFFORT`, `MODEL_FALLBACK` and `LISTEN_HOST` (not `CLAUDE_*`/`HOST`,
  which Claude Code and shells already export).
- **The stream has its own vocabulary, not the one of the architecture document.**
  `docs/arhitectura-app-biblica.md` (the stream of an answer) lists `status`, `text_delta`,
  `citation`, `perspective_marker`, `usage`, `done` and `refusal`/`error`, with resume by `message_id`,
  and a first event within about 300 ms. This slice sends `sources`, `delta`, `citation`, `done`,
  `error`. The reasons: there are no accounts or stored conversations yet, so there is no
  `message_id` to resume and no usage to settle against a budget (usage is folded into `done`, a
  refusal into `error`); `sources` takes the place of the early `status` event (it is sent before the
  model is called, retrieval takes about a millisecond, and the first byte reached `curl` in 5 to 20 ms
  on the mock server, 70 ms for the first question after start-up: well within 300 ms) and tells the
  app what the answer will be built on;
  perspective markers wait for the classifier and the perspective modes. The names `sources` and
  `delta` are the ones to rename if the app should follow the architecture document exactly.
- **A glossary carries the question across languages, not a model.** The `claude-haiku-5-5` query
  translation of the architecture would cost an extra model call (money and a few hundred
  milliseconds) per question, could not be tested offline, and needs the key to be present before anything works; a table of about 280
  concepts is deterministic, free and tested, and fixes the cases that matter now (a Romanian
  question about a book that is translated only in part). Its limits are listed under "How an answer
  is made"; the Haiku translation or the vector search replaces it when the table stops being enough.
- **Request timeouts.** Node's default of five minutes for a request body let one address hold a
  socket per rate-limit token with a single byte sent, and a few addresses could fill the machine's
  request slots. `REQUEST_TIMEOUT_MS` (15 s) and `HEADERS_TIMEOUT_MS` (10 s) now apply, with a
  shorter interval at which Node checks for stalled requests; the streamed answer is not covered.
- **`TRUST_PROXY` is not set in the image.** The image defaults to `none`; `fly.toml` sets `fly`.
  The image also stays root-owned and read-only for the service user (no `--chown`), so a
  compromised process cannot rewrite the code, the packs or the pinned public keys.
- **No source maps at run time**: `--enable-source-maps` costs 30 to 40 MB of the 256 MB machine
  (105 MB idle without it, 135 to 145 MB with it), the map is still shipped.
- **Development dependencies are pinned exactly too**, to the versions the workspace already locks
  (`@types/node` 22.20.5, `eslint` 9.39.5, `tsx` 4.23.15, `typescript` 6.0.3, `vitest` 5.1.0). `vitest`
  5.1.0 was published on 2 November 2026, younger than the two weeks asked of new dependencies, but
  it is the version every other package of the workspace already runs; pinning an older one would put a
  second `vitest` into the lockfile. The side effect of exact pins in a workspace that uses ranges:
  when the others float to a newer patch, `apps/api` stays on the pinned one until it is changed here.
- **`packages/content-tools/src/cli.ts` shows as modified in `git status`** (mode `100644` to
  `100755`, content untouched). `apps/api` depends on `@biblioteca/content-tools`, which declares a
  `bin`; at every install pnpm links that bin into `apps/api/node_modules/.bin` and sets the
  executable bit on its target. It cannot be avoided without touching `packages/` or giving up the
  dependency, and `chmod 644` is undone by the next install. Decide once, when committing: keep the
  mode on purpose (the file has a `#!/usr/bin/env tsx` shebang and is a declared bin, so `755` is what
  an install produces anyway), or run `git update-index --chmod=-x packages/content-tools/src/cli.ts`
  / `chmod 644` right before the commit.
- **Lockfile**: `pnpm-lock.yaml` changes only for the new importer (`apps/api`), its dependencies and
  the pnpm `libc` annotations. An earlier non-frozen install had also moved `boxen@7.0.0` to
  `chalk@5.6.2`; that unrelated hunk was reverted by hand and `pnpm install --frozen-lockfile` is
  clean.
