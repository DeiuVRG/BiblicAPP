import type { AddressInfo } from 'node:net';
import type { Server, ServerOptions } from 'node:http';

import { serve } from '@hono/node-server';

import { ClaudeProvider, createAnthropicClient } from './ai/claude';
import type { ClaudeClientLike } from './ai/claude';
import { MockProvider } from './ai/mock';
import type { AIProvider } from './ai/provider';
import { UsageLedger } from './ask/usage';
import { WEAK_ACCESS_CODE_CHARS, describeConfig } from './config';
import type { Config } from './config';
import { AccessGate } from './http/access';
import { createApp } from './http/app';
import { DailyQuestionCap } from './http/daily-cap';
import { Lifecycle } from './http/lifecycle';
import { TokenBucketLimiter } from './http/rate-limit';
import { buildLibrary } from './library/library';
import type { Library } from './library/library';
import { loadPacks, loadTrustedKeys } from './library/packs';
import type { RejectedPack } from './library/packs';
import { createLogger } from './logger';
import type { Logger } from './logger';
import { LogHasher } from './privacy';
import { warmGlossary } from './text/glossary';

export interface StartOptions {
  logger?: Logger;
  /** Replaces the provider chosen by AI_PROVIDER (tests). */
  provider?: AIProvider;
  /** Replaces the SDK client of the Claude provider (tests). */
  claudeClient?: ClaudeClientLike;
  /** Injected clock for the rate limiters (tests). */
  now?: () => number;
}

export interface RunningServer {
  /** The port actually bound (useful with PORT=0). */
  port: number;
  url: string;
  server: Server;
  library: Library;
  rejected: readonly RejectedPack[];
  ledger: UsageLedger;
  lifecycle: Lifecycle;
  /**
   * Graceful shutdown: stop accepting connections, let running answers finish for up to
   * `graceMs`, cut off the rest, close.
   */
  shutdown(reason?: string, graceMs?: number): Promise<void>;
}

/**
 * Limits on how long a client may take to send its request. Without them Node waits up to five
 * minutes for a body that never arrives, and a handful of addresses could fill the machine's
 * request slots with half-sent questions. They cover receiving the request only, never the answer
 * that streams back (that has its own deadline).
 */
export function httpServerOptions(
  config: Pick<Config, 'requestTimeoutMs' | 'headersTimeoutMs'>,
): ServerOptions {
  return {
    requestTimeout: config.requestTimeoutMs,
    headersTimeout: config.headersTimeoutMs,
    // Node looks for stalled requests only every `connectionsCheckingInterval` (30 s by default),
    // which would let a stalled request live that much longer than its timeout.
    connectionsCheckingInterval: Math.max(
      50,
      Math.min(2000, Math.floor(config.headersTimeoutMs / 2)),
    ),
  };
}

function chooseProvider(config: Config, logger: Logger, options: StartOptions): AIProvider {
  if (options.provider !== undefined) return options.provider;
  if (config.provider === 'mock') return new MockProvider();
  const apiKey = config.anthropicApiKey;
  if (apiKey === undefined)
    throw new Error('ANTHROPIC_API_KEY is required for the claude provider');
  const client =
    options.claudeClient ??
    createAnthropicClient({
      apiKey,
      ...(config.anthropicBaseUrl !== undefined ? { baseURL: config.anthropicBaseUrl } : {}),
      timeoutMs: config.providerTimeoutMs,
      maxRetries: config.providerMaxRetries,
      logger,
    });
  return new ClaudeProvider({
    client,
    model: config.model,
    maxOutputTokens: config.maxOutputTokens,
    effort: config.effort,
    fallback: config.fallback,
    logger,
  });
}

/** Loads and verifies the packs, builds the index and starts listening. */
export async function startServer(
  config: Config,
  options: StartOptions = {},
): Promise<RunningServer> {
  const logger = options.logger ?? createLogger({ level: config.logLevel });
  logger.info('server.starting', { config: describeConfig(config) });

  const keys = loadTrustedKeys(config.keysDir);
  for (const problem of keys.problems) logger.warn('keys.problem', { problem });
  const loaded = loadPacks(config.packsDir, keys.keys);
  for (const rejected of loaded.rejected) {
    logger.error('pack.rejected', {
      dir: rejected.dir,
      reason: rejected.reason,
      detail: rejected.detail,
    });
  }
  const library = buildLibrary(loaded.packs);
  warmGlossary();
  logger.info('library.loaded', {
    keys: keys.keys.map((key) => key.id),
    packs: library.packCount,
    works: library.workCount,
    editions: library.editionCount,
    paragraphs: library.paragraphCount,
    rejected: loaded.rejected.length,
  });
  if (library.packCount === 0) {
    logger.error('library.empty', { packsDir: config.packsDir, keysDir: config.keysDir });
  }

  const provider = chooseProvider(config, logger, options);
  const ledger = new UsageLedger();
  const lifecycle = new Lifecycle();
  const hasher = new LogHasher(config.logHashSalt);
  const limiterClock = options.now !== undefined ? { now: options.now } : {};
  const weakCodes = config.accessCodes.filter((code) => code.length < WEAK_ACCESS_CODE_CHARS);
  if (weakCodes.length > 0) {
    // Only how many, never which: a short code is the one a guesser finds, throttled or not.
    logger.warn('access.weak_codes', { count: weakCodes.length, minChars: WEAK_ACCESS_CODE_CHARS });
  }
  if (config.accessCodes.length === 0) {
    // Nothing to check: anyone who can reach the service may ask. That is the open beta when it is
    // meant, but an ACCESS_CODE that was set to nothing (a secret nobody filled in) or a paid model
    // behind it must not go unnoticed, so those are warnings.
    const mistake = config.accessCodeBlank || provider.name === 'claude';
    logger[mistake ? 'warn' : 'info']('access.open', {
      blank: config.accessCodeBlank,
      provider: provider.name,
      hint: 'POST /v1/ask is open to anyone who can reach this service; set ACCESS_CODE to close the beta',
    });
  }
  const app = createApp({
    config,
    library,
    provider,
    logger,
    hasher,
    ledger,
    lifecycle,
    access: new AccessGate(config.accessCodes, {
      failures: config.accessFailureLimit,
      ...limiterClock,
    }),
    dailyCap: new DailyQuestionCap({ limit: config.dailyQuestionCap, logger, ...limiterClock }),
    askLimiter: new TokenBucketLimiter({ ...config.rateLimit.ask, ...limiterClock }),
    readLimiter: new TokenBucketLimiter({ ...config.rateLimit.read, ...limiterClock }),
    // Superseded copies of an edition are not a problem; failed verification is.
    rejectedPacks: loaded.rejected.filter((entry) => entry.reason !== 'superseded').length,
  });

  const server = await new Promise<Server>((resolve, reject) => {
    const instance = serve(
      // The SDK uses the platform `fetch`; keep the global Request/Response untouched for it.
      {
        fetch: app.fetch,
        port: config.port,
        hostname: config.host,
        overrideGlobalObjects: false,
        serverOptions: httpServerOptions(config),
      },
      () => resolve(instance as Server),
    ) as Server;
    instance.once('error', reject);
  });
  const port = (server.address() as AddressInfo).port;
  logger.info('server.listening', {
    port,
    host: config.host,
    provider: provider.name,
    model: provider.model,
  });

  let shuttingDown: Promise<void> | undefined;
  const shutdown = (reason = 'shutdown', graceMs = config.shutdownGraceMs): Promise<void> => {
    shuttingDown ??= (async () => {
      logger.info('server.shutting_down', { reason, inFlight: lifecycle.inFlight, graceMs });
      lifecycle.startShutdown(); // /v1/health turns 503, new questions are refused
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeIdleConnections();
      const drained = await lifecycle.drain(graceMs);
      if (!drained) {
        logger.warn('server.shutdown_forced', { inFlight: lifecycle.inFlight });
        lifecycle.abortAll(); // running answers end with a "shutting_down" error event
        await lifecycle.drain(2000);
      }
      // Connections close as they fall idle, so that the last bytes of a finished answer get out;
      // whatever is still open after a moment is cut.
      let settled = false;
      void closed.then(() => (settled = true));
      const patience = Date.now() + 1500;
      while (!settled && Date.now() < patience) {
        server.closeIdleConnections();
        await new Promise<void>((resolve) => setTimeout(resolve, 25));
      }
      server.closeAllConnections();
      await closed;
      logger.info('server.stopped', { usage: ledger.snapshot() });
    })();
    return shuttingDown;
  };

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    server,
    library,
    rejected: loaded.rejected,
    ledger,
    lifecycle,
    shutdown,
  };
}
