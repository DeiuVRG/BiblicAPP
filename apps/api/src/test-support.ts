// Helpers shared by the tests (not imported by the service).

import { loadConfig } from './config';
import type { Config } from './config';
import { createLogger } from './logger';
import type { Logger } from './logger';
import { startServer } from './main';
import type { RunningServer, StartOptions } from './main';

/** A mock-provider configuration on an ephemeral loopback port, silent unless overridden. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    AI_PROVIDER: 'mock',
    PORT: '0',
    LISTEN_HOST: '127.0.0.1',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
    ...overrides,
  });
}

/** A logger that keeps its lines, parsed. */
export function capturingLogger(level: 'debug' | 'info' = 'info'): {
  logger: Logger;
  lines: Array<Record<string, unknown>>;
  raw: string[];
} {
  const lines: Array<Record<string, unknown>> = [];
  const raw: string[] = [];
  const logger = createLogger({
    level,
    write: (line) => {
      raw.push(line);
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
  });
  return { logger, lines, raw };
}

export async function startTestServer(
  overrides: Record<string, string> = {},
  options: StartOptions = {},
): Promise<RunningServer> {
  return startServer(testConfig(overrides), options);
}

export interface SseEvent {
  event: string;
  data: unknown;
  id?: string;
}

/** Parses a complete text/event-stream body. Comment lines (": keepalive") are skipped. */
export function parseSse(body: string): SseEvent[] {
  const events: SseEvent[] = [];
  for (const block of body.split(/\r?\n\r?\n/)) {
    let event = 'message';
    let id: string | undefined;
    const data: string[] = [];
    let any = false;
    for (const line of block.split(/\r?\n/)) {
      if (line === '' || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
      else if (field === 'id') id = value;
      else continue;
      any = true;
    }
    if (!any) continue;
    const frame: SseEvent = { event, data: JSON.parse(data.join('\n')) as unknown };
    if (id !== undefined) frame.id = id;
    events.push(frame);
  }
  return events;
}

export async function postAsk(
  server: RunningServer,
  body: unknown,
  init: { query?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  return fetch(`${server.url}/v1/ask${init.query ?? ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...init.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------------------------
// The real packs, loaded once per test file.

import { buildLibrary } from './library/library';
import type { Library } from './library/library';
import { loadPacks, loadTrustedKeys } from './library/packs';
import { DEFAULT_KEYS_DIR, DEFAULT_PACKS_DIR } from './paths';

let realLibrary: Library | undefined;

/** The library built from `apps/mobile/assets/packs` (verified against `content/keys`). */
export function loadRealLibrary(): Library {
  if (realLibrary === undefined) {
    const keys = loadTrustedKeys(DEFAULT_KEYS_DIR);
    const loaded = loadPacks(DEFAULT_PACKS_DIR, keys.keys);
    if (loaded.rejected.length > 0)
      throw new Error(`pack rejected: ${JSON.stringify(loaded.rejected)}`);
    realLibrary = buildLibrary(loaded.packs);
  }
  return realLibrary;
}

// ---------------------------------------------------------------------------------------------
// A stand-in for api.anthropic.com: speaks the streaming wire format of POST /v1/messages, so the
// real SDK can be pointed at it with ANTHROPIC_BASE_URL (no network, no key).

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface FakeAnthropicRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

export interface FakeAnthropicReply {
  status?: number;
  headers?: Record<string, string>;
  /** Text deltas of the answer (a streaming reply). */
  deltas?: string[];
  stopReason?: string;
  model?: string;
  usage?: Record<string, number>;
  /** JSON error body for non-200 replies. */
  error?: { type: string; message: string };
}

export interface FakeAnthropic {
  url: string;
  requests: FakeAnthropicRequest[];
  /** Decides each reply; the default answers `["Hello ", "[1]."]`. */
  reply: (request: FakeAnthropicRequest) => FakeAnthropicReply;
  close(): Promise<void>;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function startFakeAnthropic(
  reply?: (request: FakeAnthropicRequest) => FakeAnthropicReply,
): Promise<FakeAnthropic> {
  const requests: FakeAnthropicRequest[] = [];
  const fake: FakeAnthropic = {
    url: '',
    requests,
    reply: reply ?? (() => ({ deltas: ['Hello ', 'from the fake model [1].'] })),
    close: () => Promise.resolve(),
  };
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      } catch {
        /* keep {} */
      }
      const request: FakeAnthropicRequest = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body,
      };
      requests.push(request);
      const answer = fake.reply(request);
      const status = answer.status ?? 200;
      if (status !== 200) {
        res.writeHead(status, {
          'content-type': 'application/json',
          'request-id': 'req_fake_error',
          ...answer.headers,
        });
        res.end(
          JSON.stringify({
            type: 'error',
            error: answer.error ?? { type: 'api_error', message: 'fake error' },
          }),
        );
        return;
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'request-id': 'req_fake_ok',
        ...answer.headers,
      });
      const model = answer.model ?? (typeof body.model === 'string' ? body.model : 'fake-model');
      const usage = {
        input_tokens: 321,
        output_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        ...answer.usage,
      };
      res.write(
        sse('message_start', {
          type: 'message_start',
          message: {
            id: 'msg_fake',
            type: 'message',
            role: 'assistant',
            model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage,
          },
        }),
      );
      res.write(
        sse('content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' },
        }),
      );
      for (const text of answer.deltas ?? []) {
        res.write(
          sse('content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text },
          }),
        );
      }
      res.write(sse('content_block_stop', { type: 'content_block_stop', index: 0 }));
      res.write(
        sse('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: answer.stopReason ?? 'end_turn', stop_sequence: null },
          usage: { output_tokens: answer.usage?.output_tokens ?? 42 },
        }),
      );
      res.write(sse('message_stop', { type: 'message_stop' }));
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  fake.url = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`;
  fake.close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return fake;
}
