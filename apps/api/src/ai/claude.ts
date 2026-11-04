import Anthropic from '@anthropic-ai/sdk';

import type { ClaudeEffort } from '../config';
import type { Logger } from '../logger';
import type { Usage } from '../types';
import type { AIProvider, GenerateInput, GenerateResult, StopReason } from './provider';
import { ProviderError } from './provider';

/** Beta header of the server-side refusal fallback in its `"default"` form. */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// The parts of the SDK this provider touches, as structural types: the real `Anthropic` client
// satisfies them, and tests hand in a hand-written stand-in (no network, no SDK internals).

export interface StreamEventLike {
  type: string;
  delta?: unknown;
}

/** The text of a `text_delta` event; anything else (thinking, tool input, block markers) is not answer text. */
function textOf(event: StreamEventLike): string {
  if (event.type !== 'content_block_delta') return '';
  const delta = event.delta as { type?: unknown; text?: unknown } | null | undefined;
  return delta?.type === 'text_delta' && typeof delta.text === 'string' ? delta.text : '';
}

export interface MessageLike {
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
  _request_id?: string | null;
}

export interface StreamLike extends AsyncIterable<StreamEventLike> {
  finalMessage(): Promise<MessageLike>;
  readonly request_id?: string | null | undefined;
}

export interface MessagesBody {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  output_config?: { effort: ClaudeEffort };
}

export interface BetaMessagesBody extends MessagesBody {
  betas: string[];
  fallbacks: 'default';
}

export interface RequestOptionsLike {
  signal?: AbortSignal;
}

export interface ClaudeClientLike {
  messages: { stream(body: MessagesBody, options?: RequestOptionsLike): StreamLike };
  beta: { messages: { stream(body: BetaMessagesBody, options?: RequestOptionsLike): StreamLike } };
}

export interface ClaudeProviderOptions {
  client: ClaudeClientLike;
  model: string;
  maxOutputTokens: number;
  /** `null` leaves `output_config.effort` out (models that do not take it). */
  effort: ClaudeEffort | null;
  /** `default` asks for the API's server-side fallback on a refusal (beta endpoint). */
  fallback: 'off' | 'default';
  logger?: Logger;
}

function stopReason(raw: string | null): StopReason {
  switch (raw) {
    case 'end_turn':
    case 'max_tokens':
    case 'refusal':
    case 'stop_sequence':
      return raw;
    default:
      return 'other';
  }
}

function usageOf(message: MessageLike): Usage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

function retryAfter(error: InstanceType<typeof Anthropic.APIError>): number | undefined {
  const value = Number(error.headers?.get('retry-after'));
  return Number.isFinite(value) && value > 0 ? Math.min(Math.ceil(value), 600) : undefined;
}

/**
 * Maps an SDK error to what the client may be told. Authentication, permission, missing model and
 * invalid request errors are operator problems (the key, the model id, our request), reported
 * as `provider_misconfigured` without detail; a few facts about them go to the log
 * (`describeProviderFailure`), never the message.
 */
export function classifyClaudeError(error: unknown): ProviderError | null {
  if (error instanceof ProviderError) return error;
  if (error instanceof Anthropic.APIUserAbortError) return null;
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new ProviderError('The model did not answer in time.', 'timeout', 504, { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError('Could not reach the model service.', 'provider_unavailable', 502, {
      cause: error,
    });
  }
  if (error instanceof Anthropic.RateLimitError) {
    const options: { retryAfterSeconds?: number; cause: unknown } = { cause: error };
    const seconds = retryAfter(error);
    if (seconds !== undefined) options.retryAfterSeconds = seconds;
    return new ProviderError('The model service is rate limited.', 'provider_busy', 503, options);
  }
  if (error instanceof Anthropic.InternalServerError) {
    return error.status === 529
      ? new ProviderError('The model service is overloaded.', 'provider_busy', 503, {
          retryAfterSeconds: 30,
          cause: error,
        })
      : new ProviderError('The model service failed.', 'provider_unavailable', 502, {
          cause: error,
        });
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError ||
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.UnprocessableEntityError
  ) {
    return new ProviderError(
      'The model service rejected the request.',
      'provider_misconfigured',
      502,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError('The model service returned an error.', 'provider_error', 502, {
      cause: error,
    });
  }
  // The SDK's other failures (a stream it cannot parse, a retry that gave up): the message of such
  // an error can quote the response, so it is classified here and never reaches the generic
  // "internal error" log line that prints messages.
  if (error instanceof Anthropic.AnthropicError) {
    return new ProviderError(
      'The model service returned an unexpected response.',
      'provider_error',
      502,
      {
        cause: error,
      },
    );
  }
  return null;
}

/**
 * What may be logged about a failed model call: the class of the error, the HTTP status, the
 * error type and the provider's request id, each checked to be the short token it should be. Never
 * the message or the stack: the SDK builds the message from the response body, and an upstream (or
 * a proxy standing in for it, see ANTHROPIC_BASE_URL) can put anything in it, a copy of the request
 * or of a credential included.
 */
export function describeProviderFailure(error: unknown): Record<string, unknown> {
  const className = error instanceof Error ? error.constructor.name : typeof error;
  const out: Record<string, unknown> = {
    errorClass: /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(className) ? className : 'Error',
  };
  if (error instanceof Anthropic.APIError) {
    if (typeof error.status === 'number') out.status = error.status;
    if (typeof error.type === 'string' && /^[a-z][a-z_]{0,63}$/.test(error.type)) {
      out.errorType = error.type;
    }
    if (typeof error.requestID === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(error.requestID)) {
      out.providerRequestId = error.requestID;
    }
  }
  return out;
}

/** Answers with Claude through the official SDK, streaming. */
export class ClaudeProvider implements AIProvider {
  readonly name = 'claude' as const;
  readonly model: string;
  private readonly options: ClaudeProviderOptions;

  constructor(options: ClaudeProviderOptions) {
    this.options = options;
    this.model = options.model;
  }

  async *generate(input: GenerateInput): AsyncGenerator<string, GenerateResult, void> {
    const { client, effort, fallback } = this.options;
    // No temperature, top_p or top_k (the current models and API versions reject them) and no
    // thinking setting: adaptive thinking is the default and `output_config.effort` keeps it short.
    const body: MessagesBody = {
      model: this.model,
      max_tokens: this.options.maxOutputTokens,
      system: input.system,
      messages: input.messages,
      ...(effort !== null ? { output_config: { effort } } : {}),
    };
    try {
      const stream =
        fallback === 'default'
          ? client.beta.messages.stream(
              { ...body, betas: [FALLBACK_BETA], fallbacks: 'default' },
              { signal: input.signal },
            )
          : client.messages.stream(body, { signal: input.signal });
      for await (const event of stream) {
        const text = textOf(event);
        if (text !== '') yield text;
      }
      const message = await stream.finalMessage();
      const result: GenerateResult = {
        usage: usageOf(message),
        model: message.model,
        stopReason: stopReason(message.stop_reason),
      };
      const providerRequestId = stream.request_id ?? message._request_id;
      if (providerRequestId) result.providerRequestId = providerRequestId;
      return result;
    } catch (error) {
      if (input.signal.aborted) throw error;
      const classified = classifyClaudeError(error);
      if (classified === null) throw error;
      this.options.logger?.error('claude.request_failed', {
        requestId: input.requestId,
        code: classified.code,
        ...describeProviderFailure(error),
      });
      throw classified;
    }
  }
}

export interface CreateClientOptions {
  apiKey: string;
  baseURL?: string;
  timeoutMs: number;
  maxRetries: number;
  logger?: Logger;
}

/** The SDK client: bounded wait for the response, a couple of automatic retries (429, 5xx, network). */
export function createAnthropicClient(options: CreateClientOptions): ClaudeClientLike {
  const logger = options.logger;
  // The SDK's own messages only (they are fixed texts at the levels that get here); the objects it
  // passes along (errors, request details) are dropped for the reasons in `describeProviderFailure`.
  const forward = (level: 'debug' | 'info' | 'warn' | 'error') => (message: string) =>
    logger?.[level](`anthropic-sdk: ${message}`);
  return new Anthropic({
    apiKey: options.apiKey,
    ...(options.baseURL !== undefined ? { baseURL: options.baseURL } : {}),
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
    logLevel: 'warn',
    logger: {
      debug: forward('debug'),
      info: forward('info'),
      warn: forward('warn'),
      error: forward('error'),
    },
  });
}
