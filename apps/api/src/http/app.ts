import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';

import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { dailyCapMessage, errorMessage } from '../ask/messages';
import { collectAnswer, runAsk } from '../ask/pipeline';
import type { AskDeps, AskEvent, AskRequest } from '../ask/pipeline';
import { resolveScope } from '../ask/scope';
import type { UsageLedger } from '../ask/usage';
import type { Config } from '../config';
import type { Logger } from '../logger';
import type { LogHasher } from '../privacy';
import { hasNul, toWellFormed } from '../text/sanitise';
import type { AccessGate } from './access';
import { clientAddress, rateLimitKey } from './client-ip';
import type { DailyQuestionCap } from './daily-cap';
import type { Lifecycle } from './lifecycle';
import type { TokenBucketLimiter } from './rate-limit';

export interface AppDeps extends AskDeps {
  config: Config;
  lifecycle: Lifecycle;
  /** The tester access codes (none configured = open beta). */
  access: AccessGate;
  /** The global cap of questions per UTC day (limit 0 = off). */
  dailyCap: DailyQuestionCap;
  askLimiter: TokenBucketLimiter;
  readLimiter: TokenBucketLimiter;
  /** Packs found on disk that failed verification (reported by /v1/health). */
  rejectedPacks: number;
  hasher: LogHasher;
  ledger: UsageLedger;
  logger: Logger;
}

interface AppEnv {
  Variables: {
    requestId: string;
    clientKey: string;
    clientHash: string;
  };
}

const KEEPALIVE_MS = 15_000;

/**
 * Text from the client, cleaned before anything else sees it: no NUL characters (refused), lone
 * surrogates repaired (U+FFFD), surrounding whitespace removed, then 1 to `max` characters, so a
 * question or an earlier turn made of spaces is an error and never reaches the model as an empty
 * message.
 */
function textField(max: number) {
  return z
    .string()
    .refine((value) => !hasNul(value), 'must not contain NUL (U+0000) characters')
    .overwrite(toWellFormed)
    .trim()
    .min(1, 'must not be empty')
    .max(max, `must be at most ${max} characters`);
}

const idField = (what: string) => z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, `invalid ${what}`);

export const AskRequestSchema = z.object({
  question: textField(2000),
  language: z.enum(['ro', 'en']),
  conversation: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: textField(8000),
      }),
    )
    .max(50)
    .default([]),
  editionIds: z.array(idField('edition id')).max(100).optional(),
  /** Restrict retrieval to the editions of one work. */
  scope: z.strictObject({ workId: idField('work id') }).optional(),
  /** The paragraph the question is about: its section is searched first. */
  passage: z
    .strictObject({ editionId: idField('edition id'), paragraphId: idField('paragraph id') })
    .optional(),
});

export type ParsedAskRequest = z.infer<typeof AskRequestSchema>;

type ErrorStatus = 400 | 401 | 403 | 404 | 413 | 415 | 429 | 500 | 502 | 503 | 504;

/** Every error body carries the id of the request, the one of the `X-Request-Id` header. */
function jsonError(
  c: Context<AppEnv>,
  status: ErrorStatus,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return c.json({ error: { code, message, requestId: c.get('requestId'), ...extra } }, status);
}

function securityHeaders(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header('Cache-Control', 'no-store');
    await next();
  };
}

/**
 * CORS with an explicit allow-list (no wildcard). Only listed origins get `Access-Control-Allow-*`
 * headers, so a page on any other origin cannot read the responses; preflights from other
 * origins are refused.
 */
function cors(allowed: ReadonlySet<string>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // On every response, also when the request names no origin: a shared cache (a CDN in front of
    // the public library listing) must not hand the copy it made for one kind of request to
    // another, or a page on an allowed origin could be served a copy without the CORS headers.
    c.header('Vary', 'Origin', { append: true });
    const origin = c.req.header('origin');
    if (origin === undefined) return next();
    const permitted = allowed.has(origin.toLowerCase());
    if (c.req.method === 'OPTIONS') {
      if (!permitted) return c.body(null, 403);
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, X-Access-Code');
      c.header('Access-Control-Max-Age', '600');
      return c.body(null, 204);
    }
    if (permitted) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header(
        'Access-Control-Expose-Headers',
        'X-Request-Id, Retry-After, RateLimit-Limit, RateLimit-Remaining',
      );
    }
    return next();
  };
}

function requestContext(deps: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const started = performance.now();
    const requestId = randomUUID();
    const address = clientAddress(c, deps.config.trustProxy);
    const clientKey = rateLimitKey(address);
    c.set('requestId', requestId);
    c.set('clientKey', clientKey);
    c.set('clientHash', deps.hasher.hash(clientKey, 12));
    c.header('X-Request-Id', requestId);
    await next();
    const path = new URL(c.req.url).pathname;
    const fields = {
      requestId,
      method: c.req.method,
      path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - started),
      client: c.get('clientHash'),
      flyRequestId: c.req.header('fly-request-id'),
    };
    // Health checks arrive every few seconds; they are only interesting when they fail.
    if (path === '/v1/health' && c.res.status < 500) deps.logger.debug('request', fields);
    else deps.logger.info('request', fields);
  };
}

function rateLimited(
  limiter: TokenBucketLimiter,
  which: 'ask' | 'read',
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const decision = limiter.take(c.get('clientKey'));
    c.header('RateLimit-Limit', String(decision.limit));
    c.header('RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      c.header('Retry-After', String(decision.retryAfterSeconds));
      const seconds = decision.retryAfterSeconds;
      return jsonError(
        c,
        429,
        'rate_limited',
        which === 'ask'
          ? `Too many questions. Please try again in ${seconds} s. / Prea multe întrebări. Încearcă din nou peste ${seconds} s.`
          : `Too many requests. Please try again in ${seconds} s. / Prea multe cereri. Încearcă din nou peste ${seconds} s.`,
        { retryAfterSeconds: seconds },
      );
    }
    return next();
  };
}

/**
 * The closed beta: with `ACCESS_CODE` set, a question needs the header `X-Access-Code` with one of
 * the codes. It runs first, before the rate limiter (a request without the code takes no token and
 * says nothing about the limit) and before anything that could reach a model.
 *
 * Wrong codes are throttled per client by a bucket of their own (`AccessGate.admit`): a client that
 * has presented too many is refused with `429 rate_limited` and `Retry-After` without its code being
 * looked at, so a guesser is slowed down and cannot tell a right guess from a wrong one meanwhile.
 * The log stays proportionate to that: one `access.denied` per wrong code (bounded by the bucket)
 * and one `access.locked` when a client runs out; a missing code is what a first visit looks like
 * and is a debug line (the `request` line already records the 401).
 */
function accessRequired(deps: AppDeps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const decision = deps.access.admit(c.get('clientKey'), c.req.header('x-access-code'));
    if (decision.granted) return next();
    const fields = { requestId: c.get('requestId'), client: c.get('clientHash') };
    if (decision.reason === 'locked') {
      const seconds = decision.retryAfterSeconds;
      c.header('Retry-After', String(seconds));
      return jsonError(
        c,
        429,
        'rate_limited',
        `Too many wrong access codes. Please try again in ${seconds} s. / Prea multe coduri de acces greșite. Încearcă din nou peste ${seconds} s.`,
        { retryAfterSeconds: seconds },
      );
    }
    // The code itself is never logged, only that it was missing or wrong.
    if (decision.reason === 'invalid') {
      deps.logger.warn('access.denied', { ...fields, reason: 'invalid' });
      if (decision.lockedOutForSeconds !== undefined) {
        deps.logger.warn('access.locked', {
          client: fields.client,
          retryAfterSeconds: decision.lockedOutForSeconds,
        });
      }
    } else {
      deps.logger.debug('access.denied', { ...fields, reason: 'missing' });
    }
    return jsonError(
      c,
      401,
      'access_required',
      'This beta is open to testers only: send the access code in the X-Access-Code header. / Beta-ul este deschis deocamdată doar testerilor: trimite codul de acces în antetul X-Access-Code.',
    );
  };
}

function sseFrame(event: AskEvent, requestId: string): { name: string; data: unknown } {
  switch (event.type) {
    case 'sources':
      return { name: 'sources', data: event.sources };
    case 'delta':
      return { name: 'delta', data: { text: event.text } };
    case 'citation':
      return { name: 'citation', data: event.citation };
    case 'done':
      return { name: 'done', data: event.done };
    case 'error': {
      const { code, message, retryAfterSeconds } = event.error;
      return {
        name: 'error',
        data: {
          code,
          message,
          requestId,
          ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        },
      };
    }
  }
}

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const { config, library, provider, lifecycle } = deps;
  const app = new Hono<AppEnv>();
  const allowedOrigins = new Set(config.allowedOrigins);

  app.use('*', requestContext(deps));
  app.use('*', securityHeaders());
  app.use('*', cors(allowedOrigins));

  app.notFound((c) => jsonError(c, 404, 'not_found', 'No such endpoint.'));
  app.onError((error, c) => {
    deps.logger.error('request.unhandled', { requestId: c.get('requestId'), err: error });
    return jsonError(c, 500, 'internal_error', 'Something went wrong on our side.');
  });

  app.get('/', rateLimited(deps.readLimiter, 'read'), (c) =>
    c.json({ service: 'biblioteca-api', endpoints: ['/v1/health', '/v1/library', '/v1/ask'] }),
  );

  app.get('/v1/health', rateLimited(deps.readLimiter, 'read'), (c) => {
    const ok = library.packCount > 0 && !lifecycle.isShuttingDown;
    return c.json(
      {
        ok,
        packs: library.packCount,
        paragraphs: library.paragraphCount,
        model: provider.model,
        provider: provider.name,
        rejectedPacks: deps.rejectedPacks,
        ...(lifecycle.isShuttingDown ? { shuttingDown: true } : {}),
      },
      ok ? 200 : 503,
    );
  });

  app.get('/v1/library', rateLimited(deps.readLimiter, 'read'), (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      works: library.works.map(({ work, editions }) => ({
        id: work.id,
        slug: work.slug,
        title: { ro: work.titleRo, en: work.titleEn ?? work.titleOrig, original: work.titleOrig },
        author: work.author,
        year: work.year,
        languageOrig: work.languageOrig,
        editions: editions.map((edition) => {
          const source =
            edition.sourceEditionId !== undefined
              ? library.editions.get(edition.sourceEditionId)
              : undefined;
          return {
            id: edition.editionId,
            packId: edition.packId,
            language: edition.language,
            kind: edition.kind,
            ...(edition.sourceEditionId !== undefined
              ? { sourceEditionId: edition.sourceEditionId }
              : {}),
            sections: edition.sectionCount,
            paragraphs: edition.paragraphCount,
            licence: edition.licenceStatus,
            revision: edition.revision,
            version: edition.version,
            // A translation that covers fewer sections than its source is still in progress.
            partial:
              edition.kind === 'translation' &&
              source !== undefined &&
              edition.sectionCount < source.sectionCount,
            ...(source !== undefined ? { sourceSections: source.sectionCount } : {}),
          };
        }),
      })),
      totals: {
        works: library.workCount,
        editions: library.editionCount,
        packs: library.packCount,
        paragraphs: library.paragraphCount,
      },
      languages: [...library.indexes.keys()].sort(),
    });
  });

  const parseAsk = async (
    c: Context<AppEnv>,
  ): Promise<{ ok: true; value: ParsedAskRequest } | { ok: false; response: Response }> => {
    if (!/^application\/json\s*(;|$)/i.test(c.req.header('content-type') ?? '')) {
      return {
        ok: false,
        response: jsonError(
          c,
          415,
          'unsupported_media_type',
          'Send the question as application/json.',
        ),
      };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await c.req.text()) as unknown;
    } catch {
      return {
        ok: false,
        response: jsonError(c, 400, 'invalid_json', 'The request body is not valid JSON.'),
      };
    }
    const parsed = AskRequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      const message = issues.map((issue) => `${issue.path || 'body'}: ${issue.message}`).join('; ');
      return { ok: false, response: jsonError(c, 400, 'invalid_request', message, { issues }) };
    }
    return { ok: true, value: parsed.data };
  };

  app.post(
    '/v1/ask',
    accessRequired(deps),
    async (c, next) => {
      if (lifecycle.isShuttingDown) {
        c.header('Connection', 'close');
        c.header('Retry-After', '5');
        // The body is not read yet, so the language is unknown: say it in both.
        return jsonError(
          c,
          503,
          'shutting_down',
          `${errorMessage('shutting_down', 'en')} / ${errorMessage('shutting_down', 'ro')}`,
        );
      }
      if (library.packCount === 0) {
        // Every pack failed verification (or none was found): an empty library must not be
        // mistaken for "the library does not cover this".
        return jsonError(
          c,
          503,
          'library_unavailable',
          'The library is not loaded; see /v1/health.',
        );
      }
      return next();
    },
    rateLimited(deps.askLimiter, 'ask'),
    bodyLimit({
      maxSize: config.maxBodyBytes,
      onError: (c) =>
        jsonError(
          c,
          413,
          'payload_too_large',
          `The request is larger than ${config.maxBodyBytes} bytes.`,
        ),
    }),
    async (c) => {
      const parsed = await parseAsk(c);
      if (!parsed.ok) return parsed.response;
      const request = parsed.value;
      const scope = resolveScope(library, request);
      if (!scope.ok) return jsonError(c, 400, scope.code, scope.message);
      const askRequest: AskRequest = {
        question: request.question,
        language: request.language,
        conversation: request.conversation,
        ...(scope.editionIds !== undefined ? { editionIds: scope.editionIds } : {}),
        ...(scope.passage !== undefined ? { passage: scope.passage } : {}),
      };

      // The global daily cap: the answer is refused here, as an HTTP error, before any stream
      // starts. The mock provider counts too; a question that ends without a model call (nothing
      // matched) gives its slot back.
      const turn = deps.dailyCap.tryAcquire();
      if (!turn.allowed) {
        c.header('Retry-After', String(turn.retryAfterSeconds));
        return jsonError(c, 503, 'provider_busy', dailyCapMessage(request.language), {
          retryAfterSeconds: turn.retryAfterSeconds,
        });
      }

      // One controller ends the answer for any reason: the client left, the deadline passed, or the
      // server is shutting down. The reason tells the pipeline what to report.
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort('deadline'), config.askDeadlineMs);
      const onShutdown = (): void => controller.abort('shutdown');
      lifecycle.signal.addEventListener('abort', onShutdown, { once: true });
      c.req.raw.signal.addEventListener('abort', () => controller.abort('client'), { once: true });
      // The request counts as running until its socket has really finished (so a shutdown does not
      // cut the last bytes off); without a socket underneath (app.request in tests) it ends with the work.
      const end = lifecycle.begin();
      const outgoing = (c.env as { outgoing?: ServerResponse } | undefined)?.outgoing;
      if (outgoing !== undefined) outgoing.once('close', end);
      const finish = (): void => {
        clearTimeout(deadline);
        lifecycle.signal.removeEventListener('abort', onShutdown);
        if (outgoing === undefined) end();
      };

      const events = runAsk(deps, askRequest, {
        requestId: c.get('requestId'),
        clientHash: c.get('clientHash'),
        signal: controller.signal,
        onNoModelCall: () => turn.slot.release(),
      });

      if (c.req.query('stream') === 'false') {
        try {
          const result = await collectAnswer(events);
          if (!result.ok) {
            const { error } = result;
            if (error.retryAfterSeconds !== undefined)
              c.header('Retry-After', String(error.retryAfterSeconds));
            return jsonError(
              c,
              error.status,
              error.code,
              error.message,
              error.retryAfterSeconds !== undefined
                ? { retryAfterSeconds: error.retryAfterSeconds }
                : {},
            );
          }
          const { answer, sources, citations, done } = result.value;
          return c.json({
            answer,
            sources,
            citations,
            usage: done.usage,
            model: done.model,
            requestId: done.requestId,
            ...(done.providerRequestId !== undefined
              ? { providerRequestId: done.providerRequestId }
              : {}),
            stopReason: done.stopReason,
            invalidCitations: done.invalidCitations,
            quotations: done.quotations,
          });
        } finally {
          finish();
        }
      }

      c.header('X-Accel-Buffering', 'no');
      const response = streamSSE(
        c,
        async (stream) => {
          let id = 0;
          const send = async (event: AskEvent): Promise<void> => {
            const frame = sseFrame(event, c.get('requestId'));
            id += 1;
            await stream.writeSSE({
              event: frame.name,
              data: JSON.stringify(frame.data),
              id: String(id),
            });
          };
          stream.onAbort(() => controller.abort('client'));
          const keepAlive = setInterval(() => {
            stream.write(': keepalive\n\n').catch(() => undefined);
          }, KEEPALIVE_MS);
          try {
            for await (const event of events) await send(event);
          } finally {
            clearInterval(keepAlive);
            finish();
          }
        },
        async (error, stream) => {
          deps.logger.error('sse.failed', { requestId: c.get('requestId'), err: error });
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              code: 'internal_error',
              message: errorMessage('internal_error', request.language),
              requestId: c.get('requestId'),
            }),
          });
        },
      );
      // streamSSE sets `Cache-Control: no-cache` itself, over anything set before it; the stream
      // must also be left alone by proxies that rewrite or compress bodies (`no-transform`).
      response.headers.set('Cache-Control', 'no-cache, no-transform');
      return response;
    },
  );

  return app;
}
