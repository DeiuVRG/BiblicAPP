import type { PromptSource } from '../ask/sources';
import type { Language, Usage } from '../types';
import type { ChatMessage } from './prompt';

export type StopReason = 'end_turn' | 'max_tokens' | 'refusal' | 'stop_sequence' | 'other';

export interface GenerateInput {
  requestId: string;
  language: Language;
  question: string;
  system: string;
  messages: ChatMessage[];
  /** The numbered sources the prompt was built from (the mock provider cites them directly). */
  sources: readonly PromptSource[];
  /** Aborted when the client goes away, the deadline passes or the server shuts down. */
  signal: AbortSignal;
}

export interface GenerateResult {
  usage: Usage;
  /** The model that produced the answer (the fallback model after a server-side fallback). */
  model: string;
  /** The provider's own request id (Anthropic `request-id`), for support tickets. */
  providerRequestId?: string;
  stopReason: StopReason;
}

/** What the gateway needs from a model backend: a stream of answer text and a final summary. */
export interface AIProvider {
  readonly name: 'mock' | 'claude';
  readonly model: string;
  /**
   * Yields the answer text as it is produced; the generator's return value carries the usage and
   * the stop reason. Throws `ProviderError` (or aborts) when the model cannot answer.
   */
  generate(input: GenerateInput): AsyncGenerator<string, GenerateResult, void>;
}

export type ProviderErrorCode =
  | 'provider_unavailable'
  | 'provider_busy'
  | 'provider_misconfigured'
  | 'provider_error'
  | 'timeout';

/** A failure of the model backend, already classified for the client. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  /** HTTP status for the non-streaming API. */
  readonly status: 502 | 503 | 504;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    message: string,
    code: ProviderErrorCode,
    status: 502 | 503 | 504,
    options: { retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
