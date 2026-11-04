import type { PromptSource } from '../ask/sources';
import type { Language } from '../types';
import { EMPTY_USAGE } from '../types';
import type { AIProvider, GenerateInput, GenerateResult } from './provider';
import { estimateTokens } from './prompt';

const SNIPPET_CHARS = 150;

/** First sentence of the text, cut at a word boundary, without quotation marks. */
function snippet(text: string): string {
  const clean = text
    .replace(/[„”“"«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = /^.{20,}?[.!?](?=\s|$)/.exec(clean)?.[0] ?? clean;
  if (sentence.length <= SNIPPET_CHARS) return sentence;
  const cut = sentence.slice(0, SNIPPET_CHARS);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trimEnd();
}

/**
 * The deterministic answer of the mock provider: it quotes the first two sources word for word
 * and cites them, so the whole pipeline (citations, quotation check, SSE) can be exercised
 * without a model.
 */
export function mockAnswer(language: Language, sources: readonly PromptSource[]): string {
  const [first, second] = sources;
  if (language === 'ro') {
    if (first === undefined)
      return 'Răspuns de probă (niciun model AI nu a fost apelat). Nu există pasaje.';
    let answer = `Răspuns de probă (niciun model AI nu a fost apelat). Biblioteca are pasaje relevante. Întâi: „${snippet(first.text)}” [1].`;
    if (second !== undefined) answer += ` Apoi: „${snippet(second.text)}” [2].`;
    return answer;
  }
  if (first === undefined) return 'Mock answer (no AI model was called). There are no passages.';
  let answer = `Mock answer (no AI model was called). The library has relevant passages. First: "${snippet(first.text)}" [1].`;
  if (second !== undefined) answer += ` Second: "${snippet(second.text)}" [2].`;
  return answer;
}

export interface MockProviderOptions {
  /** Characters per streamed delta; small on purpose, so that markers get split across deltas. */
  chunkSize?: number;
}

export class MockProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock';
  private readonly chunkSize: number;

  constructor(options: MockProviderOptions = {}) {
    this.chunkSize = Math.max(1, options.chunkSize ?? 7);
  }

  async *generate(input: GenerateInput): AsyncGenerator<string, GenerateResult, void> {
    const answer = mockAnswer(input.language, input.sources);
    const characters = Array.from(answer);
    for (let i = 0; i < characters.length; i += this.chunkSize) {
      input.signal.throwIfAborted();
      yield characters.slice(i, i + this.chunkSize).join('');
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    const promptChars = input.system + input.messages.map((message) => message.content).join('\n');
    return {
      usage: {
        ...EMPTY_USAGE,
        inputTokens: estimateTokens(promptChars),
        outputTokens: estimateTokens(answer),
      },
      model: this.model,
      providerRequestId: `mock-${input.requestId}`,
      stopReason: 'end_turn',
    };
  }
}
