# Ask API (`apps/api`)

The "Ask" gateway of the library: a small HTTP service that answers a question **only from the
passages of the signed content packs**, with inline citations. It is the first slice of the `api`
service described in `docs/arhitectura-app-biblica.md` (sections 4 to 6): Hono on Node 22, the Claude
API behind an `AIProvider` interface, deployed on Fly.io in Frankfurt.

This is the **beta without accounts**: there is no sign-in, no consent screen and no per-user budget
yet (see [What is deferred](#what-is-deferred)). Abuse is limited by a per-IP rate limit and, above
all, by a spend limit you set in the Anthropic Console (see [Costs](#costs-and-spend-limits)).

- [Run it locally](#run-it-locally)
- [Endpoint contract](#endpoint-contract)
- [How an answer is made](#how-an-answer-is-made)
- [Configuration](#configuration)
- [Limits, privacy and security](#limits-privacy-and-security)
- [Deploying to Fly.io (steps for the owner)](#deploying-to-flyio-steps-for-the-owner)
- [Costs and spend limits](#costs-and-spend-limits)
- [What is deferred](#what-is-deferred)
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
```

Checks (all part of `pnpm -r typecheck | lint | test` from the root):
`pnpm --filter @biblioteca/api typecheck`, `... lint`, `... test` (Vitest: retrieval on the real
Vos packs, scripture references, citations, SSE framing, rate limiting, CORS, configuration,
mock end to end through a started server, the Claude provider against a stand-in API, health,
library, graceful shutdown, packaging).

## Endpoint contract

All bodies are JSON (UTF-8). Every response carries `X-Request-Id`. Errors have one shape:

```json
{ "error": { "code": "invalid_request", "message": "question: must not be empty", "issues": [{ "path": "question", "message": "must not be empty" }] } }
```

### `POST /v1/ask`

Request (`Content-Type: application/json` is required):

| Field | Type | Rules |
| --- | --- | --- |
| `question` | string | 1 to 2000 characters after trimming. Text with a NUL (`U+0000`) character is refused (`400`); lone surrogates (invalid UTF-16, which JSON can carry) are replaced by `U+FFFD`. |
| `language` | `"ro"` or `"en"` | The language of the answer, and the language whose edition is shown when a passage exists in both. |
| `conversation` | `{ role: "user" \| "assistant", content: string }[]` | Optional. Earlier turns, oldest first; up to 50 are accepted (each 1 to 8000 characters after trimming, cleaned like the question: a turn of only spaces or with a NUL is a `400`) and **the last 6 are used**. Citation markers (`[1]`) in earlier answers are dropped: their numbers belonged to earlier documents; a turn that is empty once its markers are gone is left out (the model API does not take empty messages). |
| `editionIds` | `string[]` | Optional. Restrict retrieval, and the aligned versions, to these editions (ids from `GET /v1/library`). Unknown ids are ignored; if none is known the answer is `400 unknown_editions`. |

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
- `quotations`: `{ checked, unverified }`. Every quotation in the answer (text between quotation
  marks, 20 characters or more) is checked to be word for word in the sources, modulo case,
  diacritics and punctuation; `unverified > 0` means the model quoted something that is not there.
  Clients may show such an answer with a warning.

`error`: `{ code, message, retryAfterSeconds? }` with a message in the language of the question and
no provider detail. Codes: `provider_busy` (429/529 upstream), `provider_unavailable`,
`provider_misconfigured`, `provider_error`, `timeout` (deadline passed), `refused` (the model
declined), `shutting_down`, `internal_error`. Text already streamed stays valid.

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

- Sources are **numbered by position**: `sources[0]` is `[1]` in the answer.
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
data: {"usage":{"inputTokens":2122,"outputTokens":101,"cacheReadInputTokens":0,"cacheCreationInputTokens":0},"model":"claude-sonnet-5-5","requestId":"5d5db93e-...","providerRequestId":"req_...","stopReason":"end_turn","invalidCitations":0,"quotations":{"checked":1,"unverified":0}}
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
  "quotations": { "checked": 1, "unverified": 0 }
}
```

A failure is an HTTP error with the error shape above: `502` (`provider_unavailable`,
`provider_misconfigured`, `provider_error`, `refused`), `503` (`provider_busy`, `shutting_down`,
`library_unavailable`; with `Retry-After` when known), `504` (`timeout`), `500` (`internal_error`).

#### Other status codes

| Status | `error.code` | When |
| --- | --- | --- |
| 400 | `invalid_json`, `invalid_request`, `unknown_editions` | The body is not JSON, fails validation, or none of `editionIds` is installed. |
| 413 | `payload_too_large` | Body over `MAX_BODY_BYTES` (64 KiB by default). |
| 415 | `unsupported_media_type` | `Content-Type` is not `application/json`. |
| 429 | `rate_limited` | Over the limit; `Retry-After` (seconds) and `error.retryAfterSeconds`. |
| 503 | `library_unavailable` | No pack verified at startup (see `GET /v1/health`). |

The responses of `GET /`, `GET /v1/health`, `GET /v1/library` and `POST /v1/ask` that reach their
rate limiter carry `RateLimit-Limit` and `RateLimit-Remaining` for the caller's bucket. `404`
answers, CORS preflights and the `503` answers given before the limiter (`shutting_down`,
`library_unavailable`) do not. Every response carries `X-Request-Id`.

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
4. **No passage, no answer.** If nothing matches, the model is not called: the stream is
   `sources: []`, one `delta` that says the library does not cover this yet, and `done` with
   `stopReason: "not_covered"`.
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
8. **Quotation check.** Quoted text in the answer that is not in the sources is counted in
   `done.quotations.unverified` and logged by count.
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
| `MAX_BODY_BYTES` | `65536` | Largest request body. |
| `REQUEST_TIMEOUT_MS` | `15000` | Time a client gets to send a whole request (headers and body). A slower sender is cut off with `408`; the answer that streams back is not affected. |
| `HEADERS_TIMEOUT_MS` | `10000` | Time a client gets to send the request headers (must not exceed `REQUEST_TIMEOUT_MS`). |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent`. |
| `LOG_HASH_SALT` | random per process | Salt (8+ characters) for the hashes in logs. |
| `SHUTDOWN_GRACE_MS` | `20000` | On SIGTERM, running answers get this long to finish. |

## Limits, privacy and security

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
- **CORS**: an explicit allow-list (`ALLOWED_ORIGINS`); other origins get no `Access-Control-*`
  headers and a `403` preflight. `Vary: Origin` is on every response, also when the request names no
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
- **Secrets**: the only secret is `ANTHROPIC_API_KEY`, read from the environment. It is not in the
  repository, the image, `fly.toml` or any log (tests check this).
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
- **Evaluation set** and thresholds (recall, citation validity, grounding), the nightly canary.
- **Process split and edge**: the `gateway`/`ops` groups with separate secrets, Cloudflare Tunnel
  and WAF, a shared rate limiter for more than one machine, Sentry and uptime monitoring.
- **Reload without a deploy**: packs are read at start.

## Decisions and deviations

Notes for `docs/decizii.md` (a project rule: every deviation from the architecture document is
written down there with its reason):

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
