import { connect } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { mockAnswer } from './ai/mock';
import { ProviderError } from './ai/provider';
import type { AIProvider, GenerateInput, GenerateResult } from './ai/provider';
import { buildSources } from './ask/sources';
import { retrieve } from './library/retrieve';
import { httpServerOptions } from './main';
import type { RunningServer } from './main';
import { EMPTY_USAGE } from './types';
import {
  capturingLogger,
  parseSse,
  postAsk,
  startFakeAnthropic,
  startTestServer,
  testConfig,
} from './test-support';
import type { FakeAnthropic, SseEvent } from './test-support';

const running: RunningServer[] = [];
const fakes: FakeAnthropic[] = [];

async function start(...args: Parameters<typeof startTestServer>): Promise<RunningServer> {
  const server = await startTestServer(...args);
  running.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(
    running.splice(0).map((server) => server.shutdown('test', 500).catch(() => undefined)),
  );
  await Promise.all(fakes.splice(0).map((fake) => fake.close()));
});

/** A provider whose behaviour the test scripts. */
class ScriptedProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly model = 'scripted';
  readonly inputs: GenerateInput[] = [];
  constructor(
    private readonly script: (input: GenerateInput) => AsyncGenerator<string, GenerateResult, void>,
  ) {}
  generate(input: GenerateInput): AsyncGenerator<string, GenerateResult, void> {
    this.inputs.push(input);
    return this.script(input);
  }
}

const RESULT: GenerateResult = {
  usage: { ...EMPTY_USAGE, inputTokens: 11, outputTokens: 7 },
  model: 'scripted',
  stopReason: 'end_turn',
};

const testConfigDefaults = () => testConfig({ REQUEST_TIMEOUT_MS: '', HEADERS_TIMEOUT_MS: '' });

function byEvent(events: SseEvent[], name: string): SseEvent[] {
  return events.filter((event) => event.event === name);
}

describe('GET /v1/health and /v1/library', () => {
  it('reports the verified packs and the model', async () => {
    const server = await start();
    const response = await fetch(`${server.url}/v1/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      packs: server.library.packCount,
      paragraphs: server.library.paragraphCount,
      model: 'mock',
      provider: 'mock',
      rejectedPacks: 0,
    });
    expect(server.library.packCount).toBeGreaterThanOrEqual(2);
    expect(server.library.paragraphCount).toBeGreaterThanOrEqual(139);
  });

  it('turns unhealthy when no pack verifies, so that a bad deploy never takes traffic', async () => {
    const server = await start({ KEYS_DIR: '/nonexistent' });
    const response = await fetch(`${server.url}/v1/health`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      packs: 0,
      paragraphs: 0,
      rejectedPacks: 2,
    });
    // Questions are refused rather than answered from an empty library.
    const ask = await postAsk(server, { question: 'kingdom of heaven', language: 'en' });
    expect(ask.status).toBe(503);
    expect(((await ask.json()) as { error: { code: string } }).error.code).toBe(
      'library_unavailable',
    );
  });

  it('names the configured model when the provider is claude', async () => {
    const fake = await startFakeAnthropic();
    fakes.push(fake);
    const server = await start({
      AI_PROVIDER: 'claude',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: fake.url,
      MODEL: 'claude-haiku-5-5',
    });
    expect(await (await fetch(`${server.url}/v1/health`)).json()).toMatchObject({
      ok: true,
      model: 'claude-haiku-5-5',
      provider: 'claude',
    });
  });

  it('lists the works and editions that Ask covers', async () => {
    const server = await start();
    const body = (await (await fetch(`${server.url}/v1/library`)).json()) as {
      works: Array<{
        id: string;
        title: { ro: string; en: string };
        author: { name: string };
        editions: Array<Record<string, unknown>>;
      }>;
      totals: Record<string, number>;
      languages: string[];
    };
    expect(body.works).toHaveLength(server.library.workCount);
    const vos = body.works[0]!;
    expect(vos.title.en).toBe('The Teaching of Jesus Concerning the Kingdom of God and the Church');
    expect(vos.title.ro).toBe('Învățătura lui Isus despre Împărăția lui Dumnezeu și Biserică');
    expect(vos.author.name).toBe('Geerhardus Vos');
    const english = vos.editions.find((edition) => edition.language === 'en')!;
    const romanian = vos.editions.find((edition) => edition.language === 'ro')!;
    expect(english).toMatchObject({ kind: 'source', sections: 11, partial: false });
    expect(romanian).toMatchObject({
      kind: 'translation',
      sourceEditionId: english.id,
      sourceSections: 11,
    });
    expect(romanian.partial).toBe((romanian.sections as number) < 11);
    expect(body.totals).toMatchObject({ works: 1, editions: 2 });
    expect(body.languages).toEqual(['en', 'ro']);
    const response = await fetch(`${server.url}/v1/library`);
    expect(response.headers.get('cache-control')).toContain('max-age');
  });

  it('answers 404 in JSON for anything else', async () => {
    const server = await start();
    const response = await fetch(`${server.url}/v1/nope`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'not_found' } });
    expect((await (await fetch(`${server.url}/`)).json()) as object).toMatchObject({
      service: 'biblioteca-api',
    });
  });
});

describe('POST /v1/ask (mock provider, server-sent events)', () => {
  it('streams sources, deltas, citations and a closing summary', async () => {
    const server = await start();
    const response = await postAsk(server, {
      question: 'What is the kingdom of heaven?',
      language: 'en',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-cache');
    const requestId = response.headers.get('x-request-id')!;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    const events = parseSse(await response.text());
    const names = events.map((event) => event.event);
    expect(names[0]).toBe('sources'); // early, and once
    expect(byEvent(events, 'sources')).toHaveLength(1);
    expect(names.at(-1)).toBe('done');
    expect(names.filter((name) => name === 'done')).toHaveLength(1);
    expect(names).not.toContain('error');
    expect(events.map((event) => Number(event.id))).toEqual(events.map((_, i) => i + 1));

    const sources = events[0]!.data as Array<Record<string, unknown>>;
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources[0]).toMatchObject({
      workId: server.library.works[0]!.work.id,
      language: 'en',
      kind: 'source',
      author: 'Geerhardus Vos',
      workTitle: 'The Teaching of Jesus Concerning the Kingdom of God and the Church',
    });
    for (const source of sources) {
      for (const field of [
        'id',
        'workId',
        'editionId',
        'sectionId',
        'paragraphId',
        'workTitle',
        'sectionHeading',
        'language',
        'excerpt',
      ]) {
        expect(typeof source[field], field).toBe('string');
        expect((source[field] as string).length, field).toBeGreaterThan(0);
      }
      expect(Array.isArray(source.aligned)).toBe(true);
    }

    const deltas = byEvent(events, 'delta').map((event) => (event.data as { text: string }).text);
    expect(deltas.length).toBeGreaterThan(10);
    const answer = deltas.join('');
    // The mock answer is a function of the announced sources: rebuild them and compare.
    const rebuilt = buildSources(
      server.library,
      retrieve(server.library, 'What is the kingdom of heaven?', { language: 'en' }),
      'en',
    );
    expect(rebuilt.map((entry) => entry.source.paragraphId)).toEqual(
      sources.map((source) => source.paragraphId),
    );
    expect(answer).toBe(mockAnswer('en', rebuilt));

    const citations = byEvent(events, 'citation').map(
      (event) => event.data as { sourceIndex: number; text: string; offset: number },
    );
    expect(citations.map((citation) => citation.sourceIndex)).toEqual([1, 2]);
    expect(answer.startsWith('Mock answer')).toBe(true);
    for (const citation of citations) {
      expect(answer.slice(citation.offset, citation.offset + 3)).toBe(`[${citation.sourceIndex}]`);
      expect(citation.text.length).toBeGreaterThan(10);
    }
    // A citation event comes after the delta that completes its marker.
    const firstCitation = names.indexOf('citation');
    expect(
      deltas.slice(0, names.slice(0, firstCitation).filter((n) => n === 'delta').length).join(''),
    ).toContain('[1');

    const done = events.at(-1)!.data as Record<string, unknown>;
    expect(done).toMatchObject({
      model: 'mock',
      requestId,
      stopReason: 'end_turn',
      invalidCitations: 0,
      quotations: { checked: 2, unverified: 0 },
    });
    expect((done.usage as Record<string, number>).inputTokens).toBeGreaterThan(0);
    expect((done.usage as Record<string, number>).outputTokens).toBeGreaterThan(0);
  });

  it('answers a Romanian question: the Romanian text with its English original attached where it exists, English otherwise', async () => {
    const server = await start();
    const events = parseSse(
      await (await postAsk(server, { question: 'Împărăția cerurilor', language: 'ro' })).text(),
    );
    const sources = events[0]!.data as Array<{
      language: string;
      kind: string;
      aligned: Array<{ language: string; kind: string }>;
    }>;
    expect(sources.length).toBeGreaterThan(0);
    // The translated chapters come in Romanian, each with its English original attached...
    const romanian = sources.filter((source) => source.language === 'ro');
    expect(romanian.length).toBeGreaterThan(0);
    for (const source of romanian) {
      expect(source).toMatchObject({ kind: 'translation' });
      expect(source.aligned[0]).toMatchObject({ language: 'en', kind: 'source' });
    }
    // ...and a passage that is not translated yet is offered in English instead of being missed.
    for (const source of sources.filter((entry) => entry.language !== 'ro')) {
      expect(source).toMatchObject({ language: 'en', kind: 'source', aligned: [] });
    }
    const answer = byEvent(events, 'delta')
      .map((event) => (event.data as { text: string }).text)
      .join('');
    expect(answer).toContain('Răspuns de probă');
  });

  it('answers a Romanian question from the English chapters when only the English edition is searched', async () => {
    const server = await start();
    const english = [...server.library.editions.values()].find(
      (edition) => edition.kind === 'source',
    )!;
    const events = parseSse(
      await (
        await postAsk(server, {
          question: 'Cum se leagă Împărăția de Biserică?',
          language: 'ro',
          editionIds: [english.editionId],
        })
      ).text(),
    );
    const sources = events[0]!.data as Array<{
      language: string;
      kind: string;
      sectionHeading: string;
      workTitle: string;
    }>;
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source).toMatchObject({ language: 'en', kind: 'source' });
      expect(source.workTitle).toContain('Învățătura lui Isus'); // the work is named in the answer's language
    }
    expect(sources[0]!.sectionHeading).toContain('Church');
    expect(events.at(-1)?.event).toBe('done');
  });

  it('returns one JSON document with stream=false', async () => {
    const server = await start();
    const response = await postAsk(
      server,
      { question: 'kingdom of heaven', language: 'en' },
      { query: '?stream=false' },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as {
      answer: string;
      sources: unknown[];
      citations: Array<{ sourceIndex: number; text: string; offset: number }>;
      usage: Record<string, number>;
      model: string;
      requestId: string;
    };
    expect(body.answer).toMatch(/^Mock answer/);
    expect(body.sources.length).toBeGreaterThanOrEqual(2);
    expect(body.citations.map((citation) => citation.sourceIndex)).toEqual([1, 2]);
    expect(body.usage.inputTokens).toBeGreaterThan(0);
    expect(body.model).toBe('mock');
    expect(body.requestId).toBe(response.headers.get('x-request-id'));
  });

  it('gives the same answer in both modes', async () => {
    const server = await start();
    const request = { question: 'The kingdom and the church', language: 'en' };
    const streamed = parseSse(await (await postAsk(server, request)).text());
    const json = (await (await postAsk(server, request, { query: '?stream=false' })).json()) as {
      answer: string;
    };
    expect(
      byEvent(streamed, 'delta')
        .map((event) => (event.data as { text: string }).text)
        .join(''),
    ).toBe(json.answer);
  });

  it('restricts retrieval to the editions asked for', async () => {
    const server = await start();
    const english = [...server.library.editions.values()].find(
      (edition) => edition.language === 'en',
    )!;
    const events = parseSse(
      await (
        await postAsk(server, {
          question: 'kingdom of heaven',
          language: 'en',
          editionIds: [english.editionId],
        })
      ).text(),
    );
    const sources = events[0]!.data as Array<{ editionId: string; aligned: unknown[] }>;
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.editionId).toBe(english.editionId);
      expect(source.aligned).toEqual([]);
    }
  });

  it('says plainly that the library does not cover a question, without calling the model', async () => {
    const provider = new ScriptedProvider(async function* () {
      yield 'should not be called';
      return RESULT;
    });
    const server = await start({}, { provider });
    const events = parseSse(
      await (await postAsk(server, { question: 'xyzzy plugh', language: 'en' })).text(),
    );
    expect(events.map((event) => event.event)).toEqual(['sources', 'delta', 'done']);
    expect(events[0]!.data).toEqual([]);
    expect((events[1]!.data as { text: string }).text).toContain('does not cover this yet');
    expect(events[2]!.data).toMatchObject({ stopReason: 'not_covered', usage: EMPTY_USAGE });
    expect(provider.inputs).toHaveLength(0);
    const ro = parseSse(
      await (await postAsk(server, { question: 'xyzzy plugh', language: 'ro' })).text(),
    );
    expect((ro[1]!.data as { text: string }).text).toContain('nu acoperă încă această întrebare');
  });

  it('uses the conversation: a vague follow-up searches with the earlier question', async () => {
    const server = await start();
    const events = parseSse(
      await (
        await postAsk(server, {
          question: 'And what does he say about it?',
          language: 'en',
          conversation: [
            { role: 'user', content: 'What is the kingdom of heaven?' },
            { role: 'assistant', content: 'It is the rule of God [1].' },
          ],
        })
      ).text(),
    );
    expect((events[0]!.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('hands the model the system prompt, the history and the numbered documents', async () => {
    const provider = new ScriptedProvider(async function* () {
      yield 'ok';
      return RESULT;
    });
    const server = await start({}, { provider });
    const conversation = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `turn ${i} about the kingdom`,
    }));
    await (
      await postAsk(server, { question: 'kingdom of heaven', language: 'en', conversation })
    ).text();
    const input = provider.inputs[0]!;
    expect(input.system).toContain('ONLY the numbered documents');
    expect(input.messages).toHaveLength(7); // the last six turns + the documents and question
    expect(input.messages[0]).toEqual({ role: 'user', content: 'turn 4 about the kingdom' });
    expect(input.messages.at(-1)!.content).toContain('<document index="1">');
    expect(input.messages.at(-1)!.content).toContain('<question>\nkingdom of heaven\n</question>');
    expect(input.sources.length).toBeGreaterThan(0);
  });

  it('sends the model no empty message and no invalid UTF-16', async () => {
    const provider = new ScriptedProvider(async function* () {
      yield 'ok';
      return RESULT;
    });
    const server = await start({}, { provider });
    // Written by hand: JSON.stringify would escape the lone surrogates the client sends.
    const body =
      '{"question":" kingdom \\ud800 of heaven \\udc00 ","language":"en","conversation":[' +
      '{"role":"user","content":"first \\ud83d"},' +
      '{"role":"assistant","content":"[1]"},' +
      '{"role":"user","content":"second"},' +
      '{"role":"assistant","content":"  [2] [3]  "}]}';
    const response = await postAsk(server, body);
    expect(parseSse(await response.text()).at(-1)?.event).toBe('done');
    const input = provider.inputs[0]!;
    expect(input.question).toBe('kingdom \uFFFD of heaven \uFFFD');
    expect(input.messages.map((message) => message.role)).toEqual(['user', 'user', 'user']);
    for (const message of input.messages) {
      expect(message.content.trim()).not.toBe('');
      expect(message.content).not.toMatch(/[\uD800-\uDFFF](?![\uDC00-\uDFFF])/);
    }
    expect(input.messages[0]?.content).toBe('first \uFFFD');
    expect(input.messages.at(-1)!.content).toContain('kingdom \uFFFD of heaven \uFFFD');
  });
});

describe('POST /v1/ask: what the gateway checks in an answer', () => {
  const answering = (text: string) =>
    new ScriptedProvider(async function* () {
      for (const piece of text.match(/.{1,5}/gs) ?? []) yield piece;
      return RESULT;
    });

  it('announces valid citations only and counts the others', async () => {
    const server = await start(
      {},
      { provider: answering('Near [1][2]. Elsewhere [99] and [0], and [1, 2].') },
    );
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(
      byEvent(events, 'citation').map(
        (event) => (event.data as { sourceIndex: number }).sourceIndex,
      ),
    ).toEqual([1, 2, 1, 2]);
    expect(events.at(-1)!.data).toMatchObject({ invalidCitations: 2 });
  });

  it('reports a quotation that is not in the sources, and accepts one that is', async () => {
    const server = await start(
      {},
      {
        provider: answering('He wrote "the kingdom is a purely private feeling of the heart" [1].'),
      },
    );
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(events.at(-1)!.data).toMatchObject({ quotations: { checked: 1, unverified: 1 } });
    const { logger, lines } = capturingLogger();
    const logged = await start(
      {},
      {
        provider: answering('He wrote "the kingdom is a purely private feeling of the heart" [1].'),
        logger,
      },
    );
    await (await postAsk(logged, { question: 'kingdom of heaven', language: 'en' })).text();
    expect(lines.find((line) => line.msg === 'ask.unverified_quotations')).toMatchObject({
      count: 1,
    });
  });

  it('passes on a cut-off answer with its stop reason', async () => {
    const provider = new ScriptedProvider(async function* () {
      yield 'An answer that was cut';
      return { ...RESULT, stopReason: 'max_tokens' as const };
    });
    const server = await start({}, { provider });
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(events.at(-1)).toMatchObject({ event: 'done', data: { stopReason: 'max_tokens' } });
  });
});

describe('POST /v1/ask validation', () => {
  it.each([
    [{ language: 'en' }, 'question'],
    [{ question: '', language: 'en' }, 'question'],
    [{ question: '   ', language: 'en' }, 'question'],
    [{ question: 'x'.repeat(2001), language: 'en' }, 'question'],
    [{ question: 'ok', language: 'fr' }, 'language'],
    [{ question: 'ok' }, 'language'],
    [{ question: 5, language: 'en' }, 'question'],
    [
      { question: 'ok', language: 'en', conversation: [{ role: 'system', content: 'x' }] },
      'conversation',
    ],
    [
      { question: 'ok', language: 'en', conversation: [{ role: 'user', content: '' }] },
      'conversation',
    ],
    // Text made of nothing, or of NUL characters, is an error and never reaches the model.
    [{ question: '\n\t ', language: 'en' }, 'question'],
    [{ question: 'kingdom\u0000 of heaven', language: 'en' }, 'question'],
    [
      { question: 'ok', language: 'en', conversation: [{ role: 'user', content: ' \n ' }] },
      'conversation',
    ],
    [
      { question: 'ok', language: 'en', conversation: [{ role: 'assistant', content: 'a\u0000' }] },
      'conversation',
    ],
    [{ question: 'ok', language: 'en', editionIds: ['bad id!'] }, 'editionIds'],
    [{ question: 'ok', language: 'en', editionIds: 'E1' }, 'editionIds'],
  ])('rejects %j', async (body, field) => {
    const server = await start();
    const response = await postAsk(server, body);
    expect(response.status).toBe(400);
    const error = (
      (await response.json()) as {
        error: { code: string; message: string; issues: Array<{ path: string }> };
      }
    ).error;
    expect(error.code).toBe('invalid_request');
    expect(error.issues.some((issue) => issue.path.startsWith(field))).toBe(true);
  });

  it('accepts a question of exactly 2000 characters', async () => {
    const server = await start();
    const response = await postAsk(
      server,
      { question: 'kingdom '.repeat(250).trim().padEnd(2000, 'x'), language: 'en' },
      { query: '?stream=false' },
    );
    expect(response.status).toBe(200);
  });

  it('rejects text that is not JSON, and other content types', async () => {
    const server = await start();
    const broken = await postAsk(server, '{"question":');
    expect(broken.status).toBe(400);
    expect(((await broken.json()) as { error: { code: string } }).error.code).toBe('invalid_json');
    const text = await postAsk(server, 'question=x', { headers: { 'content-type': 'text/plain' } });
    expect(text.status).toBe(415);
    const missing = await fetch(`${server.url}/v1/ask`, { method: 'POST', body: '{}' });
    expect(missing.status).toBe(415);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe(
      'unsupported_media_type',
    );
  });

  it('rejects a body over the size limit', async () => {
    const server = await start({ MAX_BODY_BYTES: '1024' });
    const response = await postAsk(server, {
      question: 'ok',
      language: 'en',
      conversation: [{ role: 'user', content: 'x'.repeat(2000) }],
    });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'payload_too_large',
    );
  });

  it('rejects editions the library does not have', async () => {
    const server = await start();
    const response = await postAsk(server, {
      question: 'kingdom',
      language: 'en',
      editionIds: ['NO_SUCH_EDITION'],
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'unknown_editions',
    );
  });

  it('keeps only the last 6 turns of a long conversation and accepts up to 50', async () => {
    const server = await start();
    const many = Array.from({ length: 51 }, () => ({ role: 'user' as const, content: 'x' }));
    expect(
      (await postAsk(server, { question: 'kingdom', language: 'en', conversation: many })).status,
    ).toBe(400);
  });
});

/** Sends raw bytes and returns what the server wrote before it closed the connection. */
function rawExchange(
  port: number,
  bytes: string,
  limitMs = 5000,
): Promise<{ text: string; closedAfterMs: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const socket = connect(port, '127.0.0.1');
    let text = '';
    const giveUp = setTimeout(() => {
      socket.destroy();
      reject(new Error(`the server kept the connection open for ${limitMs} ms`));
    }, limitMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(bytes));
    socket.on('data', (chunk: string) => (text += chunk));
    socket.on('error', () => undefined); // a reset after the 408 is as good as a close
    socket.on('close', () => {
      clearTimeout(giveUp);
      resolve({ text, closedAfterMs: Date.now() - started });
    });
  });
}

describe('requests that are sent too slowly', () => {
  const HEAD =
    'POST /v1/ask HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 100\r\n';

  it('has limits by default, so that Node does not wait five minutes for a body', () => {
    expect(httpServerOptions(testConfigDefaults())).toMatchObject({
      requestTimeout: 15_000,
      headersTimeout: 10_000,
    });
  });

  it('cuts off a body that stalls after one byte (408) and frees the slot', async () => {
    // Before: Node's default requestTimeout (300 s) let one address hold 20 such sockets for five
    // minutes (one per rate-limit token), and a few addresses could fill the machine.
    const server = await start({ REQUEST_TIMEOUT_MS: '300', HEADERS_TIMEOUT_MS: '200' });
    expect(server.server.requestTimeout).toBe(300);
    expect(server.server.headersTimeout).toBe(200);
    const stalled = await rawExchange(server.port, `${HEAD}\r\n{`);
    expect(stalled.text).toMatch(/^HTTP\/1\.1 408 /);
    expect(stalled.closedAfterMs).toBeLessThan(3000);
    // The server is fine and answers normally.
    expect((await fetch(`${server.url}/v1/health`)).status).toBe(200);
  });

  it('cuts off headers that never end', async () => {
    const server = await start({ REQUEST_TIMEOUT_MS: '300', HEADERS_TIMEOUT_MS: '200' });
    const stalled = await rawExchange(server.port, HEAD); // no blank line after the headers
    expect(stalled.text).toMatch(/^HTTP\/1\.1 408 /);
    expect(stalled.closedAfterMs).toBeLessThan(3000);
  });

  it('does not apply to the answer: a stream that outlives the request timeout is not cut', async () => {
    const provider = new ScriptedProvider(async function* () {
      yield 'First part ';
      await new Promise((resolve) => setTimeout(resolve, 800));
      yield 'second part [1].';
      return RESULT;
    });
    const server = await start(
      { REQUEST_TIMEOUT_MS: '300', HEADERS_TIMEOUT_MS: '200' },
      { provider },
    );
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(
      byEvent(events, 'delta')
        .map((event) => (event.data as { text: string }).text)
        .join(''),
    ).toBe('First part second part [1].');
    expect(events.at(-1)?.event).toBe('done');
  });
});

describe('rate limiting', () => {
  it('allows the configured number of questions, then answers 429 with Retry-After', async () => {
    const server = await start({ RATE_LIMIT_MAX: '2', RATE_LIMIT_WINDOW_SECONDS: '600' });
    const ask = () =>
      postAsk(
        server,
        { question: 'kingdom of heaven', language: 'en' },
        { query: '?stream=false' },
      );
    const first = await ask();
    expect(first.status).toBe(200);
    expect(first.headers.get('ratelimit-limit')).toBe('2');
    expect(first.headers.get('ratelimit-remaining')).toBe('1');
    expect((await ask()).status).toBe(200);
    const third = await ask();
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    const body = (await third.json()) as {
      error: { code: string; message: string; retryAfterSeconds: number };
    };
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.retryAfterSeconds).toBe(Number(third.headers.get('retry-after')));
    expect(body.error.message).toContain('Prea multe întrebări');
  });

  it('counts a refused question against the sender only, per address', async () => {
    const server = await start({ RATE_LIMIT_MAX: '1', TRUST_PROXY: 'xff' });
    const ask = (ip: string) =>
      postAsk(
        server,
        { question: 'kingdom', language: 'en' },
        { query: '?stream=false', headers: { 'x-forwarded-for': `10.9.9.9, ${ip}` } },
      );
    expect((await ask('198.51.100.1')).status).toBe(200);
    expect((await ask('198.51.100.1')).status).toBe(429);
    expect((await ask('198.51.100.2')).status).toBe(200);
  });

  it('does not trust forwarding headers unless told to', async () => {
    const server = await start({ RATE_LIMIT_MAX: '1' });
    const ask = (ip: string) =>
      postAsk(
        server,
        { question: 'kingdom', language: 'en' },
        { query: '?stream=false', headers: { 'x-forwarded-for': ip, 'fly-client-ip': ip } },
      );
    expect((await ask('198.51.100.1')).status).toBe(200);
    expect((await ask('198.51.100.2')).status).toBe(429); // same socket, spoofed headers ignored
  });

  it('reads the client address from Fly-Client-IP behind Fly', async () => {
    const server = await start({ RATE_LIMIT_MAX: '1', TRUST_PROXY: 'fly' });
    const ask = (ip: string) =>
      postAsk(
        server,
        { question: 'kingdom', language: 'en' },
        { query: '?stream=false', headers: { 'fly-client-ip': ip } },
      );
    expect((await ask('198.51.100.1')).status).toBe(200);
    expect((await ask('198.51.100.1')).status).toBe(429);
    expect((await ask('198.51.100.2')).status).toBe(200);
  });

  it('does not let a header that is not an address mint rate-limit keys', async () => {
    // Behind Fly the proxy sets Fly-Client-IP; anything else in it is not an address and is
    // ignored, so changing it on every request does not give a fresh bucket each time.
    const server = await start({ RATE_LIMIT_MAX: '1', TRUST_PROXY: 'fly' });
    const ask = (value: string) =>
      postAsk(
        server,
        { question: 'kingdom', language: 'en' },
        { query: '?stream=false', headers: { 'fly-client-ip': value } },
      );
    expect((await ask('junk-1')).status).toBe(200);
    expect((await ask('junk-2')).status).toBe(429);
    expect((await ask('<script>')).status).toBe(429);
    expect((await ask('x'.repeat(4000))).status).toBe(429);
  });

  it('puts RateLimit-* on the answers that reach a limiter and on no others, as documented', async () => {
    const server = await start();
    for (const path of ['/', '/v1/health', '/v1/library']) {
      const response = await fetch(`${server.url}${path}`);
      await response.text();
      expect(response.headers.get('ratelimit-limit'), path).toBe('120');
      expect(response.headers.get('ratelimit-remaining'), path).not.toBeNull();
    }
    const notFound = await fetch(`${server.url}/nope`);
    await notFound.text();
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get('ratelimit-limit')).toBeNull();
    const preflight = await fetch(`${server.url}/v1/ask`, {
      method: 'OPTIONS',
      headers: { origin: 'https://deiuvrg.github.io', 'access-control-request-method': 'POST' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('ratelimit-limit')).toBeNull();
    // The 503s given before the limiter: the library did not load, or the server is stopping.
    const broken = await start({ KEYS_DIR: '/nonexistent' });
    const unavailable = await postAsk(broken, { question: 'kingdom', language: 'en' });
    await unavailable.text();
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('ratelimit-limit')).toBeNull();
    server.lifecycle.startShutdown();
    const stopping = await postAsk(server, { question: 'kingdom', language: 'en' });
    await stopping.text();
    expect(stopping.status).toBe(503);
    expect(stopping.headers.get('ratelimit-limit')).toBeNull();
  });

  it('limits the read endpoints separately and more generously', async () => {
    const server = await start({ RATE_LIMIT_READ_MAX: '3', RATE_LIMIT_READ_WINDOW_SECONDS: '60' });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await fetch(`${server.url}/v1/library`)).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    // Questions have their own bucket.
    expect(
      (await postAsk(server, { question: 'kingdom', language: 'en' }, { query: '?stream=false' }))
        .status,
    ).toBe(200);
  });
});

describe('CORS and security headers', () => {
  it('answers the preflight of an allowed origin', async () => {
    const server = await start();
    const response = await fetch(`${server.url}/v1/ask`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://deiuvrg.github.io',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://deiuvrg.github.io');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    expect(response.headers.get('vary')).toContain('Origin');
  });

  it('allows the Expo web dev server by default', async () => {
    const server = await start();
    const response = await postAsk(
      server,
      { question: 'kingdom', language: 'en' },
      { query: '?stream=false', headers: { origin: 'http://localhost:8081' } },
    );
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    expect(response.headers.get('access-control-expose-headers')).toContain('X-Request-Id');
  });

  it('gives no CORS headers to other origins and refuses their preflight', async () => {
    const server = await start();
    const preflight = await fetch(`${server.url}/v1/ask`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
    const actual = await fetch(`${server.url}/v1/health`, {
      headers: { origin: 'https://evil.example' },
    });
    expect(actual.status).toBe(200);
    expect(actual.headers.get('access-control-allow-origin')).toBeNull();
    expect(actual.headers.get('vary')).toContain('Origin');
    const plain = await fetch(`${server.url}/v1/health`);
    expect(plain.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('varies on Origin even when the request names none (shared caches)', async () => {
    // /v1/library is publicly cacheable. A cache that stored the copy made for a request without
    // an Origin header, and that header lacked "Vary: Origin", would serve it to pages on an
    // allowed origin without the CORS headers.
    const server = await start();
    const responses = [
      await fetch(`${server.url}/v1/library`),
      await fetch(`${server.url}/v1/health`),
      await fetch(`${server.url}/v1/nope`),
      await postAsk(server, { question: 'kingdom', language: 'en' }),
      await postAsk(server, { language: 'en' }),
    ];
    for (const response of responses) {
      await response.text();
      expect(response.headers.get('vary')).toMatch(/\bOrigin\b/);
    }
    const library = await fetch(`${server.url}/v1/library`);
    expect(library.headers.get('cache-control')).toContain('public');
    expect(library.headers.get('access-control-allow-origin')).toBeNull();
    // With an origin it is listed once, not twice.
    const withOrigin = await fetch(`${server.url}/v1/library`, {
      headers: { origin: 'https://deiuvrg.github.io' },
    });
    expect(withOrigin.headers.get('vary')).toBe('Origin');
  });

  it('tells proxies to leave the answer stream alone', async () => {
    const server = await start();
    const stream = await postAsk(server, { question: 'kingdom of heaven', language: 'en' });
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    expect(stream.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(stream.headers.get('x-accel-buffering')).toBe('no');
    await stream.text();
    const json = await postAsk(
      server,
      { question: 'kingdom of heaven', language: 'en' },
      { query: '?stream=false' },
    );
    expect(json.headers.get('cache-control')).toBe('no-store');
  });

  it('takes the allow-list from ALLOWED_ORIGINS', async () => {
    const server = await start({ ALLOWED_ORIGINS: 'https://app.example' });
    const allowed = await fetch(`${server.url}/v1/health`, {
      headers: { origin: 'https://app.example' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.example');
    const formerDefault = await fetch(`${server.url}/v1/health`, {
      headers: { origin: 'https://deiuvrg.github.io' },
    });
    expect(formerDefault.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sets security headers on every kind of response', async () => {
    const server = await start();
    const responses = [
      await fetch(`${server.url}/v1/health`),
      await fetch(`${server.url}/v1/nope`),
      await postAsk(server, { question: 'kingdom', language: 'en' }),
      await postAsk(server, { language: 'en' }),
    ];
    for (const response of responses) {
      await response.text();
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(response.headers.get('strict-transport-security')).toContain('max-age=');
      expect(response.headers.get('x-request-id')).toBeTruthy();
    }
    expect(responses[0]!.headers.get('cache-control')).toBe('no-store');
  });
});

describe('when the model cannot answer', () => {
  const failing = (error: unknown, partial?: string) =>
    new ScriptedProvider(async function* () {
      if (partial !== undefined) yield partial;
      throw error;
    });

  it('reports a provider failure as an error event and not as a hang', async () => {
    const provider = failing(
      new ProviderError('upstream said: secret detail', 'provider_busy', 503, {
        retryAfterSeconds: 12,
      }),
      'Partial ',
    );
    const server = await start({}, { provider });
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(events.map((event) => event.event)).toEqual(['sources', 'delta', 'error']);
    const error = events.at(-1)!.data as {
      code: string;
      message: string;
      retryAfterSeconds: number;
    };
    expect(error).toEqual({
      code: 'provider_busy',
      message: 'The AI service is busy. Please try again shortly.',
      retryAfterSeconds: 12,
    });
    expect(JSON.stringify(events)).not.toContain('secret detail');
  });

  it('localises the message', async () => {
    const server = await start(
      {},
      { provider: failing(new ProviderError('x', 'provider_unavailable', 502)) },
    );
    const events = parseSse(
      await (await postAsk(server, { question: 'Împărăția cerurilor', language: 'ro' })).text(),
    );
    expect((events.at(-1)!.data as { message: string }).message).toBe(
      'Serviciul AI este momentan indisponibil. Încearcă din nou peste puțin timp.',
    );
  });

  it('answers with an HTTP error status when streaming is off', async () => {
    const server = await start(
      {},
      { provider: failing(new ProviderError('x', 'provider_busy', 503, { retryAfterSeconds: 9 })) },
    );
    const response = await postAsk(
      server,
      { question: 'kingdom of heaven', language: 'en' },
      { query: '?stream=false' },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('9');
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'provider_busy',
    );
    const timeout = await start({}, { provider: failing(new ProviderError('x', 'timeout', 504)) });
    expect(
      (
        await postAsk(
          timeout,
          { question: 'kingdom of heaven', language: 'en' },
          { query: '?stream=false' },
        )
      ).status,
    ).toBe(504);
  });

  it('does not leak the message of an unexpected error', async () => {
    const { logger, raw } = capturingLogger();
    const server = await start(
      {},
      { provider: failing(new TypeError('internal path /srv/secret.ts')), logger },
    );
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(events.at(-1)!.data).toMatchObject({ code: 'internal_error' });
    expect(JSON.stringify(events)).not.toContain('secret.ts');
    expect(raw.join('\n')).toContain('secret.ts'); // but the operator sees it
  });

  it('turns a refusal into an error event', async () => {
    const provider = new ScriptedProvider(async function* () {
      yield 'I cannot';
      return { ...RESULT, stopReason: 'refusal' as const };
    });
    const server = await start({}, { provider });
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'refused' } });
    expect(byEvent(events, 'done')).toHaveLength(0);
  });

  it('ends an answer that runs past the deadline', async () => {
    const provider = new ScriptedProvider(async function* (input) {
      yield 'Slow ';
      await new Promise((_, reject) =>
        input.signal.addEventListener('abort', () => reject(new Error('aborted'))),
      );
      return RESULT;
    });
    const server = await start({ ASK_DEADLINE_MS: '150' }, { provider });
    const events = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'timeout' } });
    const json = await postAsk(
      server,
      { question: 'kingdom of heaven', language: 'en' },
      { query: '?stream=false' },
    );
    expect(json.status).toBe(504);
  });

  it('notices a client that goes away', async () => {
    let seenReason: unknown;
    let release!: () => void;
    const started = new Promise<void>((resolve) => (release = resolve));
    const provider = new ScriptedProvider(async function* (input) {
      yield 'First ';
      release();
      await new Promise<void>((_, reject) =>
        input.signal.addEventListener('abort', () => {
          seenReason = input.signal.reason;
          reject(new Error('aborted'));
        }),
      );
      return RESULT;
    });
    const { logger, lines } = capturingLogger();
    const server = await start({}, { provider, logger });
    const controller = new AbortController();
    const response = await fetch(`${server.url}/v1/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'kingdom of heaven', language: 'en' }),
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    await reader.read();
    await started;
    controller.abort();
    await reader.cancel().catch(() => undefined);
    for (let i = 0; i < 50 && seenReason === undefined; i += 1)
      await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seenReason).toBe('client');
    for (let i = 0; i < 50 && !lines.some((line) => line.msg === 'ask.aborted'); i += 1)
      await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lines.some((line) => line.msg === 'ask.aborted')).toBe(true);
  });
});

describe('logging', () => {
  it('never writes the question or the address, only hashes', async () => {
    const { logger, raw, lines } = capturingLogger('debug');
    const server = await start({ LOG_HASH_SALT: 'test-salt-for-hashes' }, { logger });
    const question = 'Why is the kingdom of heaven near, zebrafish?';
    await (await postAsk(server, { question, language: 'en' }, { query: '?stream=false' })).text();
    await (
      await postAsk(server, {
        question,
        language: 'en',
        conversation: [{ role: 'user', content: 'earlier zebrafish' }],
      })
    ).text();
    const text = raw.join('\n');
    expect(text).not.toContain('zebrafish');
    expect(text).not.toContain('kingdom of heaven near');
    // The bind address is configuration; client addresses never appear.
    const perRequest = lines.filter(
      (line) => line.msg === 'request' || String(line.msg).startsWith('ask.'),
    );
    expect(perRequest.length).toBeGreaterThan(0);
    expect(JSON.stringify(perRequest)).not.toContain('127.0.0.1');
    const completed = lines.filter((line) => line.msg === 'ask.completed');
    expect(completed).toHaveLength(2);
    expect(completed[0]).toMatchObject({
      language: 'en',
      provider: 'mock',
      model: 'mock',
      stopReason: 'end_turn',
      citations: 2,
      questionChars: question.length,
    });
    expect(completed[0]!.questionHash).toMatch(/^[0-9a-f]{16}$/);
    expect(completed[0]!.questionHash).toBe(completed[1]!.questionHash);
    expect(completed[0]!.client).toMatch(/^[0-9a-f]{12}$/);
    expect(completed[0]!.inputTokens).toBeGreaterThan(0);
    expect(typeof completed[0]!.retrievalMs).toBe('number');
    expect(typeof completed[0]!.totalMs).toBe('number');
    expect(
      lines.some(
        (line) => line.msg === 'request' && line.path === '/v1/ask' && line.status === 200,
      ),
    ).toBe(true);
  });

  it('keeps health checks out of the info log', async () => {
    const { logger, lines } = capturingLogger('info');
    const server = await start({}, { logger });
    await fetch(`${server.url}/v1/health`);
    expect(lines.filter((line) => line.msg === 'request')).toEqual([]);
  });

  it('logs the configuration without secrets and records usage', async () => {
    const { logger, raw, lines } = capturingLogger();
    const fake = await startFakeAnthropic();
    fakes.push(fake);
    const server = await start(
      {
        AI_PROVIDER: 'claude',
        ANTHROPIC_API_KEY: 'test-key-do-not-log',
        ANTHROPIC_BASE_URL: fake.url,
      },
      { logger },
    );
    await (
      await postAsk(
        server,
        { question: 'kingdom of heaven', language: 'en' },
        { query: '?stream=false' },
      )
    ).text();
    expect(raw.join('\n')).not.toContain('test-key-do-not-log');
    expect(lines.find((line) => line.msg === 'server.starting')).toMatchObject({
      config: { anthropicApiKeySet: true },
    });
    expect(server.ledger.snapshot()).toMatchObject({
      requests: 1,
      inputTokens: 321,
      outputTokens: 42,
    });
  });
});

describe('graceful shutdown', () => {
  it('lets a running answer finish, refuses new work, then stops', async () => {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    let started!: () => void;
    const running = new Promise<void>((resolve) => (started = resolve));
    const provider = new ScriptedProvider(async function* () {
      yield 'Before ';
      started();
      await gate;
      yield 'after.';
      return RESULT;
    });
    const server = await start({}, { provider });
    const answer = postAsk(server, { question: 'kingdom of heaven', language: 'en' }).then(
      (response) => response.text(),
    );
    await running;
    const stopping = server.shutdown('test', 5000);
    for (let i = 0; i < 50 && !server.lifecycle.isShuttingDown; i += 1)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(server.lifecycle.isShuttingDown).toBe(true);
    expect(server.lifecycle.inFlight).toBe(1);
    // New connections are refused while the old answer runs.
    await expect(fetch(`${server.url}/v1/health`)).rejects.toBeDefined();
    open();
    const events = parseSse(await answer);
    expect(events.at(-1)!.event).toBe('done');
    expect(
      byEvent(events, 'delta')
        .map((event) => (event.data as { text: string }).text)
        .join(''),
    ).toBe('Before after.');
    await stopping;
    expect(server.lifecycle.inFlight).toBe(0);
  });

  it('cuts off an answer that outlives the grace period, telling the client', async () => {
    const provider = new ScriptedProvider(async function* (input) {
      yield 'Never ';
      await new Promise((_, reject) =>
        input.signal.addEventListener('abort', () => reject(new Error('aborted'))),
      );
      return RESULT;
    });
    const { logger, lines } = capturingLogger();
    const server = await start({}, { provider, logger });
    const answer = postAsk(server, { question: 'kingdom of heaven', language: 'en' }).then(
      (response) => response.text(),
    );
    for (let i = 0; i < 50 && provider.inputs.length === 0; i += 1)
      await new Promise((resolve) => setTimeout(resolve, 10));
    await server.shutdown('test', 100);
    const events = parseSse(await answer);
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'shutting_down' } });
    expect(lines.some((line) => line.msg === 'server.shutdown_forced')).toBe(true);
    expect(lines.at(-1)).toMatchObject({ msg: 'server.stopped' });
  });

  it('turns health to 503 and refuses questions as soon as shutdown starts', async () => {
    const server = await start();
    server.lifecycle.startShutdown();
    const health = await fetch(`${server.url}/v1/health`);
    expect(health.status).toBe(503);
    expect(await health.json()).toMatchObject({ ok: false, shuttingDown: true });
    const ask = await postAsk(server, { question: 'kingdom of heaven', language: 'en' });
    expect(ask.status).toBe(503);
    expect(((await ask.json()) as { error: { code: string } }).error.code).toBe('shutting_down');
  });

  it('is safe to call twice', async () => {
    const server = await start();
    await Promise.all([server.shutdown('a', 100), server.shutdown('b', 100)]);
  });
});

describe('the Claude provider end to end (real SDK, stand-in API)', () => {
  it('sends a clean request and streams the answer through the gateway', async () => {
    const fake = await startFakeAnthropic(() => ({
      deltas: [
        'Vos writes that the kingdom is near ',
        '[1]',
        ', and that it is ',
        'both present and future [',
        '2].',
      ],
      usage: { input_tokens: 2500, output_tokens: 33, cache_read_input_tokens: 100 },
    }));
    fakes.push(fake);
    const server = await start({
      AI_PROVIDER: 'claude',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: fake.url,
      PROVIDER_MAX_RETRIES: '0',
      MODEL: 'claude-sonnet-5-5',
    });
    const response = await postAsk(server, {
      question: 'What is the kingdom of heaven?',
      language: 'en',
    });
    const events = parseSse(await response.text());

    const request = fake.requests[0]!;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/v1/messages');
    expect(request.body).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 1200,
      stream: true,
      output_config: { effort: 'low' },
    });
    for (const forbidden of ['temperature', 'top_p', 'top_k', 'thinking', 'fallbacks'])
      expect(request.body).not.toHaveProperty(forbidden);
    expect(String(request.body.system)).toContain('ONLY the numbered documents');
    const messages = request.body.messages as Array<{ role: string; content: string }>;
    expect(messages.at(-1)).toMatchObject({ role: 'user' });
    expect(messages.at(-1)!.content).toContain('<document index="1">');
    expect(
      `${request.headers['authorization'] ?? ''}${request.headers['x-api-key'] ?? ''}`,
    ).toContain('test-key');

    const answer = byEvent(events, 'delta')
      .map((event) => (event.data as { text: string }).text)
      .join('');
    expect(answer).toBe(
      'Vos writes that the kingdom is near [1], and that it is both present and future [2].',
    );
    expect(
      byEvent(events, 'citation').map(
        (event) => (event.data as { sourceIndex: number }).sourceIndex,
      ),
    ).toEqual([1, 2]);
    expect(events.at(-1)).toMatchObject({
      event: 'done',
      data: {
        model: 'claude-sonnet-5-5',
        providerRequestId: 'req_fake_ok',
        stopReason: 'end_turn',
        usage: {
          inputTokens: 2500,
          outputTokens: 33,
          cacheReadInputTokens: 100,
          cacheCreationInputTokens: 0,
        },
      },
    });
  });

  it('uses the beta endpoint only when the fallback is switched on', async () => {
    const fake = await startFakeAnthropic();
    fakes.push(fake);
    const server = await start({
      AI_PROVIDER: 'claude',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: fake.url,
      PROVIDER_MAX_RETRIES: '0',
      MODEL_FALLBACK: 'default',
      MODEL_EFFORT: 'none',
      MAX_OUTPUT_TOKENS: '900',
    });
    await (
      await postAsk(
        server,
        { question: 'kingdom of heaven', language: 'en' },
        { query: '?stream=false' },
      )
    ).text();
    const request = fake.requests[0]!;
    expect(request.body).toMatchObject({ fallbacks: 'default', max_tokens: 900 });
    expect(request.body).not.toHaveProperty('output_config');
    expect(String(request.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
  });

  it.each([
    [429, 'rate_limit_error', 503, 'provider_busy'],
    [529, 'overloaded_error', 503, 'provider_busy'],
    [500, 'api_error', 502, 'provider_unavailable'],
    [401, 'authentication_error', 502, 'provider_misconfigured'],
    [400, 'invalid_request_error', 502, 'provider_misconfigured'],
  ])('maps an API status of %s to a clean error', async (status, type, httpStatus, code) => {
    const fake = await startFakeAnthropic(() => ({
      status,
      error: { type, message: 'upstream detail that must not leak' },
      headers: status === 429 ? { 'retry-after': '4' } : ({} as Record<string, string>),
    }));
    fakes.push(fake);
    const server = await start({
      AI_PROVIDER: 'claude',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: fake.url,
      PROVIDER_MAX_RETRIES: '0',
    });
    const response = await postAsk(
      server,
      { question: 'kingdom of heaven', language: 'en' },
      { query: '?stream=false' },
    );
    expect(response.status).toBe(httpStatus);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ error: { code } });
    expect(text).not.toContain('upstream detail');
    if (status === 429) expect(response.headers.get('retry-after')).toBe('4');
    const streamed = parseSse(
      await (await postAsk(server, { question: 'kingdom of heaven', language: 'en' })).text(),
    );
    expect(streamed.at(-1)).toMatchObject({ event: 'error', data: { code } });
  });

  it('never logs what the upstream says, even when it echoes the key and the question', async () => {
    // The SDK builds its error message from the response body. A stand-in or proxy (ANTHROPIC_BASE_URL)
    // can answer with a copy of the request: the key from the header, the question from the body.
    const { logger, raw, lines } = capturingLogger('debug');
    const fake = await startFakeAnthropic((request) => ({
      status: 401,
      error: {
        type: 'authentication_error',
        message: `rejected ${String(request.headers['authorization'])} ${String(request.headers['x-api-key'])} for ${JSON.stringify(request.body.messages)}`,
      },
    }));
    fakes.push(fake);
    const server = await start(
      {
        AI_PROVIDER: 'claude',
        ANTHROPIC_API_KEY: 'test-key-do-not-log-1234567890',
        ANTHROPIC_BASE_URL: fake.url,
        PROVIDER_MAX_RETRIES: '0',
      },
      { logger },
    );
    const response = await postAsk(
      server,
      { question: 'kingdom of heaven zebrafish', language: 'en' },
      { query: '?stream=false' },
    );
    expect(response.status).toBe(502);
    expect(fake.requests).toHaveLength(1);
    const text = raw.join('\n');
    expect(text).not.toContain('test-key-do-not-log-1234567890');
    expect(text).not.toContain('zebrafish');
    expect(text).not.toContain('<documents>');
    const failure = lines.find((line) => line.msg === 'claude.request_failed')!;
    expect(failure).toMatchObject({
      code: 'provider_misconfigured',
      status: 401,
      errorType: 'authentication_error',
      errorClass: 'AuthenticationError',
      providerRequestId: 'req_fake_error',
    });
    expect(failure).not.toHaveProperty('err');
  });

  it('logs the model API address without user info, query or fragment', async () => {
    const { logger, raw, lines } = capturingLogger();
    const fake = await startFakeAnthropic();
    fakes.push(fake);
    await start(
      {
        AI_PROVIDER: 'claude',
        ANTHROPIC_API_KEY: 'test-key',
        ANTHROPIC_BASE_URL: `${fake.url}/gateway?token=hunter2#frag`,
      },
      { logger },
    );
    const starting = lines.find((line) => line.msg === 'server.starting') as {
      config: { anthropicBaseUrl: string };
    };
    expect(starting.config.anthropicBaseUrl).toBe(`${fake.url}/gateway`);
    expect(raw.join('\n')).not.toContain('hunter2');
  });

  it('refuses to start without a key when the claude provider is chosen', async () => {
    await expect(startTestServer({ AI_PROVIDER: 'claude' })).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
