# @biblioteca/api

The "Ask" gateway of the library: Hono on Node 22 that answers questions from the signed content
packs, with citations, streamed as Server-Sent Events. The model sits behind an `AIProvider`
interface (`mock` for development and tests, `claude` for the Anthropic API).

Everything about it (endpoint contract, configuration, deployment to Fly.io, limits, what is
deferred) is in [`docs/ask-api.md`](../../docs/ask-api.md).

```bash
AI_PROVIDER=mock pnpm --filter @biblioteca/api dev    # http://localhost:8787
pnpm --filter @biblioteca/api test                    # Vitest
pnpm --filter @biblioteca/api build                   # tsc --noEmit + bundle to dist/server.js
docker build -f apps/api/Dockerfile -t biblioteca-api .   # from the repository root
```

Layout: `src/config.ts` (environment, zod), `src/library/` (pack loading and verification, the
index, retrieval), `src/text/` (folding, stop words, stemmers, scripture references, the Romanian-English glossary that carries a question across languages), `src/search/`
(BM25), `src/ai/` (providers, prompt, citation parsing), `src/ask/` (the ask flow), `src/http/`
(app, rate limit, shutdown), `src/main.ts` / `src/server.ts` (start-up).
