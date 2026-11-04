import { performance } from 'node:perf_hooks';

import { CitationTracker, verifyQuotations } from '../ai/citations';
import { MAX_HISTORY_TURNS, buildPrompt } from '../ai/prompt';
import { ProviderError } from '../ai/provider';
import type { AIProvider, StopReason } from '../ai/provider';
import { retrieve } from '../library/retrieve';
import type { Library } from '../library/library';
import type { Logger } from '../logger';
import type { LogHasher } from '../privacy';
import type { Citation, ConversationTurn, Language, Source, Usage } from '../types';
import { EMPTY_USAGE } from '../types';
import { errorMessage, notCoveredAnswer } from './messages';
import type { ErrorCode } from './messages';
import { buildSources } from './sources';
import type { UsageLedger } from './usage';

export interface AskRequest {
  question: string;
  language: Language;
  conversation: ConversationTurn[];
  editionIds?: string[] | undefined;
}

export interface AskDeps {
  library: Library;
  provider: AIProvider;
  logger: Logger;
  hasher: LogHasher;
  ledger: UsageLedger;
}

export interface AskContext {
  requestId: string;
  /** Hash of the client address, for the logs. */
  clientHash: string;
  /** Aborted with 'client', 'deadline' or 'shutdown'. */
  signal: AbortSignal;
}

export interface DonePayload {
  usage: Usage;
  model: string;
  /** This gateway's id for the request (also the `X-Request-Id` header and the log lines). */
  requestId: string;
  /** The model provider's id for the call, when it has one. */
  providerRequestId?: string;
  stopReason: StopReason | 'not_covered';
  /** `[n]` markers that pointed outside the sources. */
  invalidCitations: number;
  /** Quotation marks in the answer: how many were checked and how many are not in the sources. */
  quotations: { checked: number; unverified: number };
}

export interface AskError {
  code: ErrorCode;
  message: string;
  /** HTTP status for the non-streaming API. */
  status: 500 | 502 | 503 | 504;
  retryAfterSeconds?: number;
}

export type AskEvent =
  | { type: 'sources'; sources: Source[] }
  | { type: 'delta'; text: string }
  | { type: 'citation'; citation: Citation }
  | { type: 'done'; done: DonePayload }
  | { type: 'error'; error: AskError };

function errorEvent(
  code: ErrorCode,
  language: Language,
  status: AskError['status'],
  retryAfterSeconds?: number,
): AskEvent {
  const error: AskError = { code, message: errorMessage(code, language), status };
  if (retryAfterSeconds !== undefined) error.retryAfterSeconds = retryAfterSeconds;
  return { type: 'error', error };
}

/**
 * The whole ask flow as a stream of events: retrieve, announce the sources, stream the answer
 * while tracking its citations, then close with usage. Transport-agnostic: the SSE route sends
 * the events as they come, the JSON route collects them.
 */
export async function* runAsk(
  deps: AskDeps,
  request: AskRequest,
  context: AskContext,
): AsyncGenerator<AskEvent, void, void> {
  const { library, provider, logger, ledger } = deps;
  const { language } = request;
  const started = performance.now();
  const base = {
    requestId: context.requestId,
    client: context.clientHash,
    questionHash: deps.hasher.hash(request.question),
    questionChars: request.question.length,
    language,
    provider: provider.name,
    turns: request.conversation.length,
  };

  const priorQuestions = request.conversation
    .slice(-MAX_HISTORY_TURNS)
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.content);
  const retrieval = retrieve(library, request.question, {
    language,
    history: priorQuestions,
    ...(request.editionIds !== undefined ? { editionIds: new Set(request.editionIds) } : {}),
  });
  const promptSources = buildSources(library, retrieval, language);
  const sources = promptSources.map((entry) => entry.source);
  const retrievalMs = Math.round(performance.now() - started);
  yield { type: 'sources', sources };

  // No passage, no answer: say so without spending a model call.
  if (promptSources.length === 0) {
    yield { type: 'delta', text: notCoveredAnswer(language) };
    yield {
      type: 'done',
      done: {
        usage: EMPTY_USAGE,
        model: provider.model,
        requestId: context.requestId,
        stopReason: 'not_covered',
        invalidCitations: 0,
        quotations: { checked: 0, unverified: 0 },
      },
    };
    logger.info('ask.completed', {
      ...base,
      sources: 0,
      retrievalMs,
      totalMs: Math.round(performance.now() - started),
      stopReason: 'not_covered',
    });
    return;
  }

  const prompt = buildPrompt({
    language,
    question: request.question,
    history: request.conversation,
    sources: promptSources,
  });
  const tracker = new CitationTracker(sources.length);
  const generator = provider.generate({
    requestId: context.requestId,
    language,
    question: request.question,
    system: prompt.system,
    messages: prompt.messages,
    sources: promptSources,
    signal: context.signal,
  });

  let firstDeltaMs: number | undefined;
  let finished = false;
  try {
    let step = await generator.next();
    while (step.done !== true) {
      firstDeltaMs ??= Math.round(performance.now() - started);
      yield { type: 'delta', text: step.value };
      for (const citation of tracker.push(step.value)) yield { type: 'citation', citation };
      step = await generator.next();
    }
    finished = true;
    const result = step.value;

    if (result.stopReason === 'refusal') {
      logger.warn('ask.refused', {
        ...base,
        model: result.model,
        providerRequestId: result.providerRequestId,
      });
      ledger.record(result.usage);
      yield errorEvent('refused', language, 502);
      return;
    }

    const quotations = verifyQuotations(tracker.answer, promptSources);
    if (quotations.unverified.length > 0) {
      // Logged by count only: the text of an answer can echo the question.
      logger.warn('ask.unverified_quotations', {
        ...base,
        count: quotations.unverified.length,
        checked: quotations.checked,
      });
    }
    ledger.record(result.usage);
    const done: DonePayload = {
      usage: result.usage,
      model: result.model,
      requestId: context.requestId,
      stopReason: result.stopReason,
      invalidCitations: tracker.invalidMarkers,
      quotations: { checked: quotations.checked, unverified: quotations.unverified.length },
    };
    if (result.providerRequestId !== undefined) done.providerRequestId = result.providerRequestId;
    yield { type: 'done', done };
    logger.info('ask.completed', {
      ...base,
      model: result.model,
      providerRequestId: result.providerRequestId,
      sources: sources.length,
      topScore: sources[0]?.score,
      usedHistory: retrieval.usedHistory,
      refs: retrieval.refs.length,
      retrievalMs,
      firstDeltaMs,
      totalMs: Math.round(performance.now() - started),
      stopReason: result.stopReason,
      citations: tracker.citations.length,
      invalidCitations: tracker.invalidMarkers,
      quotationsChecked: quotations.checked,
      quotationsUnverified: quotations.unverified.length,
      ...result.usage,
    });
  } catch (error) {
    finished = true;
    if (context.signal.aborted) {
      const cause: unknown = context.signal.reason;
      if (cause === 'client') {
        logger.info('ask.aborted', { ...base, totalMs: Math.round(performance.now() - started) });
        return; // nobody is listening
      }
      const code: ErrorCode = cause === 'shutdown' ? 'shutting_down' : 'timeout';
      logger.warn('ask.failed', {
        ...base,
        code,
        totalMs: Math.round(performance.now() - started),
      });
      yield errorEvent(code, language, code === 'timeout' ? 504 : 503);
      return;
    }
    if (error instanceof ProviderError) {
      logger.warn('ask.failed', { ...base, code: error.code, status: error.status });
      yield errorEvent(error.code, language, error.status, error.retryAfterSeconds);
      return;
    }
    logger.error('ask.failed', { ...base, code: 'internal_error', err: error });
    yield errorEvent('internal_error', language, 500);
  } finally {
    // The consumer may stop early (client gone): let the provider close its stream.
    if (!finished)
      await generator
        .return({ usage: EMPTY_USAGE, model: provider.model, stopReason: 'other' })
        .catch(() => undefined);
  }
}

export interface CollectedAnswer {
  answer: string;
  sources: Source[];
  citations: Citation[];
  done: DonePayload;
}

/** Runs the flow to the end for the non-streaming API. */
export async function collectAnswer(
  events: AsyncIterable<AskEvent>,
): Promise<{ ok: true; value: CollectedAnswer } | { ok: false; error: AskError }> {
  let answer = '';
  let sources: Source[] = [];
  const citations: Citation[] = [];
  let done: DonePayload | undefined;
  for await (const event of events) {
    if (event.type === 'sources') sources = event.sources;
    else if (event.type === 'delta') answer += event.text;
    else if (event.type === 'citation') citations.push(event.citation);
    else if (event.type === 'done') done = event.done;
    else return { ok: false, error: event.error };
  }
  if (done === undefined) {
    return {
      ok: false,
      error: { code: 'internal_error', message: 'The answer ended without a result.', status: 500 },
    };
  }
  return { ok: true, value: { answer, sources, citations, done } };
}
