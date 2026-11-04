import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import { buildSources } from '../ask/sources';
import { retrieve } from '../library/retrieve';
import { capturingLogger, loadRealLibrary } from '../test-support';
import {
  ClaudeProvider,
  FALLBACK_BETA,
  classifyClaudeError,
  describeProviderFailure,
} from './claude';
import type {
  BetaMessagesBody,
  ClaudeClientLike,
  MessageLike,
  MessagesBody,
  StreamEventLike,
  StreamLike,
} from './claude';
import { buildPrompt } from './prompt';
import { ProviderError } from './provider';
import type { GenerateInput, GenerateResult } from './provider';

const library = loadRealLibrary();

function input(signal = new AbortController().signal): GenerateInput {
  const sources = buildSources(
    library,
    retrieve(library, 'kingdom of heaven', { language: 'en' }),
    'en',
  );
  const prompt = buildPrompt({
    language: 'en',
    question: 'kingdom of heaven',
    history: [],
    sources,
  });
  return {
    requestId: 'req-1',
    language: 'en',
    question: 'kingdom of heaven',
    system: prompt.system,
    messages: prompt.messages,
    sources,
    signal,
  };
}

function delta(text: string): StreamEventLike {
  return { type: 'content_block_delta', delta: { type: 'text_delta', text } };
}

const FINAL: MessageLike = {
  model: 'claude-sonnet-5-5',
  stop_reason: 'end_turn',
  usage: {
    input_tokens: 1000,
    output_tokens: 120,
    cache_creation_input_tokens: 5,
    cache_read_input_tokens: 400,
  },
};

class FakeClient implements ClaudeClientLike {
  readonly calls: Array<{
    via: 'messages' | 'beta';
    body: MessagesBody | BetaMessagesBody;
    signal?: AbortSignal;
  }> = [];
  constructor(
    private readonly events: StreamEventLike[] = [delta('Hello '), delta('[1].')],
    private readonly final: MessageLike = FINAL,
    private readonly requestId: string | null | undefined = 'req_abc',
    private readonly fail?: unknown,
  ) {}

  private stream(): StreamLike {
    const { events, final, requestId, fail } = this;
    return {
      request_id: requestId,
      async *[Symbol.asyncIterator]() {
        for (const event of events) yield event;
        if (fail !== undefined) throw fail;
      },
      finalMessage: () => Promise.resolve(final),
    };
  }

  messages = {
    stream: (body: MessagesBody, options?: { signal?: AbortSignal }): StreamLike => {
      this.calls.push({
        via: 'messages',
        body,
        ...(options?.signal ? { signal: options.signal } : {}),
      });
      return this.stream();
    },
  };
  beta = {
    messages: {
      stream: (body: BetaMessagesBody, options?: { signal?: AbortSignal }): StreamLike => {
        this.calls.push({
          via: 'beta',
          body,
          ...(options?.signal ? { signal: options.signal } : {}),
        });
        return this.stream();
      },
    },
  };
}

async function run(
  provider: ClaudeProvider,
  generateInput = input(),
): Promise<{ deltas: string[]; result: GenerateResult }> {
  const generator = provider.generate(generateInput);
  const deltas: string[] = [];
  let step = await generator.next();
  while (step.done !== true) {
    deltas.push(step.value);
    step = await generator.next();
  }
  return { deltas, result: step.value };
}

const options = (
  client: ClaudeClientLike,
  extra: Partial<ConstructorParameters<typeof ClaudeProvider>[0]> = {},
) => ({
  client,
  model: 'claude-sonnet-5-5',
  maxOutputTokens: 1200,
  effort: 'low' as const,
  fallback: 'off' as const,
  ...extra,
});

describe('ClaudeProvider request', () => {
  it('sends the prompt with the settings the current models accept', async () => {
    const client = new FakeClient();
    const generateInput = input();
    await run(new ClaudeProvider(options(client)), generateInput);
    expect(client.calls).toHaveLength(1);
    const call = client.calls[0]!;
    expect(call.via).toBe('messages');
    expect(call.body).toEqual({
      model: 'claude-sonnet-5-5',
      max_tokens: 1200,
      system: generateInput.system,
      messages: generateInput.messages,
      output_config: { effort: 'low' },
    });
    // Nothing the current API versions reject: sampling parameters, thinking budgets, prefill.
    for (const forbidden of ['temperature', 'top_p', 'top_k', 'thinking', 'betas', 'fallbacks']) {
      expect(call.body).not.toHaveProperty(forbidden);
    }
    expect(call.body.messages.at(-1)?.role).toBe('user');
    expect(call.signal).toBe(generateInput.signal);
  });

  it('leaves the effort out when it is switched off', async () => {
    const client = new FakeClient();
    await run(new ClaudeProvider(options(client, { effort: null, maxOutputTokens: 800 })));
    expect(client.calls[0]?.body).not.toHaveProperty('output_config');
    expect(client.calls[0]?.body.max_tokens).toBe(800);
  });

  it('asks for the server-side refusal fallback on the beta endpoint when enabled', async () => {
    const client = new FakeClient();
    await run(new ClaudeProvider(options(client, { fallback: 'default' })));
    const call = client.calls[0]!;
    expect(call.via).toBe('beta');
    expect(call.body).toMatchObject({
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      model: 'claude-sonnet-5-5',
    });
    expect(FALLBACK_BETA).toBe('server-side-fallback-2026-07-01');
  });
});

describe('ClaudeProvider response', () => {
  it('streams only answer text', async () => {
    const client = new FakeClient([
      { type: 'message_start' },
      { type: 'content_block_start' },
      { type: 'content_block_delta', delta: { type: 'thinking_delta', text: 'hidden' } },
      { type: 'content_block_delta', delta: { type: 'input_json_delta' } },
      delta('The '),
      delta(''),
      delta('answer [1]'),
      { type: 'message_delta', delta: {} },
    ]);
    const { deltas } = await run(new ClaudeProvider(options(client)));
    expect(deltas).toEqual(['The ', 'answer [1]']);
  });

  it('reports usage, model, stop reason and the provider request id', async () => {
    const { result } = await run(new ClaudeProvider(options(new FakeClient())));
    expect(result).toEqual({
      usage: {
        inputTokens: 1000,
        outputTokens: 120,
        cacheReadInputTokens: 400,
        cacheCreationInputTokens: 5,
      },
      model: 'claude-sonnet-5-5',
      providerRequestId: 'req_abc',
      stopReason: 'end_turn',
    });
  });

  it('treats missing cache counters as zero and falls back to the message request id', async () => {
    const final: MessageLike = {
      model: 'claude-opus-5-5',
      stop_reason: 'max_tokens',
      usage: { input_tokens: 10, output_tokens: 1200, cache_creation_input_tokens: null },
      _request_id: 'req_from_message',
    };
    const { result } = await run(
      new ClaudeProvider(options(new FakeClient([delta('x')], final, null))),
    );
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 1200,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    expect(result.stopReason).toBe('max_tokens');
    expect(result.model).toBe('claude-opus-5-5');
    expect(result.providerRequestId).toBe('req_from_message');
  });

  it('maps stop reasons', async () => {
    for (const [raw, mapped] of [
      ['refusal', 'refusal'],
      ['stop_sequence', 'stop_sequence'],
      [null, 'other'],
      ['pause_turn', 'other'],
    ] as const) {
      const { result } = await run(
        new ClaudeProvider(options(new FakeClient([], { ...FINAL, stop_reason: raw }))),
      );
      expect(result.stopReason).toBe(mapped);
    }
  });
});

const headers = (values: Record<string, string> = {}) => new Headers(values);
const apiError = (status: number, headerValues: Record<string, string> = {}) =>
  Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type: 'x', message: `status ${status}` } },
    `status ${status}`,
    headers(headerValues),
  );

describe('classifyClaudeError', () => {
  it.each([
    [apiError(429, { 'retry-after': '7' }), 'provider_busy', 503, 7],
    [apiError(429), 'provider_busy', 503, undefined],
    [apiError(529), 'provider_busy', 503, 30],
    [apiError(500), 'provider_unavailable', 502, undefined],
    [apiError(503), 'provider_unavailable', 502, undefined],
    [apiError(401), 'provider_misconfigured', 502, undefined],
    [apiError(403), 'provider_misconfigured', 502, undefined],
    [apiError(404), 'provider_misconfigured', 502, undefined],
    [apiError(400), 'provider_misconfigured', 502, undefined],
    [apiError(418), 'provider_error', 502, undefined],
    [new Anthropic.APIConnectionError({}), 'provider_unavailable', 502, undefined],
    [new Anthropic.APIConnectionTimeoutError(), 'timeout', 504, undefined],
  ])('%s', (error, code, status, retryAfter) => {
    const classified = classifyClaudeError(error)!;
    expect(classified).toBeInstanceOf(ProviderError);
    expect(classified.code).toBe(code);
    expect(classified.status).toBe(status);
    expect(classified.retryAfterSeconds).toBe(retryAfter);
    // The client is never shown what the provider said.
    expect(classified.message).not.toMatch(/status \d+/);
  });

  it('leaves aborts and unknown errors alone', () => {
    expect(classifyClaudeError(new Anthropic.APIUserAbortError())).toBeNull();
    expect(classifyClaudeError(new TypeError('boom'))).toBeNull();
    expect(classifyClaudeError('text')).toBeNull();
  });

  it('classifies the SDK failures that are not API errors (an unparseable stream)', () => {
    // Their messages quote the response; classified here, they never reach the generic
    // "internal error" log line that prints messages.
    const failure = new Anthropic.AnthropicError(
      'Could not parse message into JSON: {"zebrafish"}',
    );
    const classified = classifyClaudeError(failure)!;
    expect(classified).toBeInstanceOf(ProviderError);
    expect(classified.code).toBe('provider_error');
    expect(classified.status).toBe(502);
    expect(classified.message).not.toContain('zebrafish');
    expect(classified.cause).toBe(failure);
  });
});

describe('what is logged about a failed call', () => {
  // The upstream's own text: a stand-in or proxy can put anything here, a copy of the request or
  // of the credential included.
  const hostile = apiErrorWith(401, {
    type: 'error',
    error: {
      type: 'authentication_error',
      message: 'invalid credential Bearer KEY-1234567890-ABCDEF for the question about zebrafish',
    },
  });

  function apiErrorWith(status: number, body: object) {
    return Anthropic.APIError.generate(
      status,
      body,
      undefined,
      headers({ 'request-id': 'req_77' }),
    );
  }

  it('describeProviderFailure keeps short facts and leaves the message and the stack out', () => {
    const facts = describeProviderFailure(hostile);
    expect(facts).toEqual({
      errorClass: 'AuthenticationError',
      status: 401,
      errorType: 'authentication_error',
      providerRequestId: 'req_77',
    });
    expect(JSON.stringify(facts)).not.toMatch(/KEY-|zebrafish|stack|message/);
    expect(hostile.message).toContain('zebrafish'); // the SDK does put the body in the message
  });

  it('checks each fact to be the short token it should be', () => {
    const odd = Anthropic.APIError.generate(
      418,
      { error: { type: 'Contains Spaces And A Secret' } },
      undefined,
      headers({ 'request-id': 'req with spaces and a secret' }),
    );
    expect(describeProviderFailure(odd)).toEqual({ errorClass: 'APIError', status: 418 });
    expect(describeProviderFailure(new RangeError('x'))).toEqual({ errorClass: 'RangeError' });
    expect(describeProviderFailure('text')).toEqual({ errorClass: 'string' });
    expect(describeProviderFailure(new Anthropic.APIConnectionTimeoutError())).toEqual({
      errorClass: 'APIConnectionTimeoutError',
    });
  });

  it('logs claude.request_failed with those facts and the classified code only', async () => {
    const { logger, lines, raw } = capturingLogger();
    const provider = new ClaudeProvider({
      ...options(new FakeClient([], FINAL, 'req', hostile)),
      logger,
    });
    await expect(run(provider)).rejects.toBeInstanceOf(ProviderError);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'error',
      msg: 'claude.request_failed',
      requestId: 'req-1',
      code: 'provider_misconfigured',
      errorClass: 'AuthenticationError',
      status: 401,
      errorType: 'authentication_error',
      providerRequestId: 'req_77',
    });
    expect(lines[0]).not.toHaveProperty('err');
    expect(raw.join('\n')).not.toMatch(/KEY-1234567890|zebrafish|stack|at .*\.ts/);
  });
});

describe('ClaudeProvider errors', () => {
  it('turns an SDK error into a ProviderError and keeps the cause for the log', async () => {
    const cause = apiError(429, { 'retry-after': '3' });
    const provider = new ClaudeProvider(
      options(new FakeClient([delta('partial ')], FINAL, 'req', cause)),
    );
    const generator = provider.generate(input());
    expect((await generator.next()).value).toBe('partial ');
    const failure = await generator.next().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ProviderError);
    expect((failure as ProviderError).code).toBe('provider_busy');
    expect((failure as ProviderError).cause).toBe(cause);
  });

  it('lets an abort through untouched', async () => {
    const controller = new AbortController();
    controller.abort('client');
    const abort = new Anthropic.APIUserAbortError();
    const provider = new ClaudeProvider(options(new FakeClient([], FINAL, 'r', abort)));
    await expect(run(provider, input(controller.signal))).rejects.toBe(abort);
  });

  it('rethrows what it cannot classify', async () => {
    const provider = new ClaudeProvider(
      options(new FakeClient([], FINAL, 'r', new RangeError('bug'))),
    );
    await expect(run(provider)).rejects.toBeInstanceOf(RangeError);
  });
});
