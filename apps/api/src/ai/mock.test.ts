import { describe, expect, it } from 'vitest';

import { buildSources } from '../ask/sources';
import { retrieve } from '../library/retrieve';
import { loadRealLibrary } from '../test-support';
import { CitationTracker, verifyQuotations } from './citations';
import { MockProvider, mockAnswer } from './mock';
import { buildPrompt } from './prompt';

const library = loadRealLibrary();

async function run(provider: MockProvider, language: 'ro' | 'en', question: string) {
  const sources = buildSources(library, retrieve(library, question, { language }), language);
  const prompt = buildPrompt({ language, question, history: [], sources });
  const generator = provider.generate({
    requestId: 'r1',
    language,
    question,
    system: prompt.system,
    messages: prompt.messages,
    sources,
    signal: new AbortController().signal,
  });
  const deltas: string[] = [];
  let step = await generator.next();
  while (step.done !== true) {
    deltas.push(step.value);
    step = await generator.next();
  }
  return { sources, deltas, result: step.value };
}

describe('MockProvider', () => {
  it('answers deterministically, quoting and citing the first two sources', async () => {
    const first = await run(new MockProvider(), 'en', 'kingdom of heaven');
    const second = await run(new MockProvider(), 'en', 'kingdom of heaven');
    const answer = first.deltas.join('');
    expect(answer).toBe(second.deltas.join(''));
    expect(answer).toContain('[1]');
    expect(answer).toContain('[2]');
    expect(answer).not.toContain('[3]');
    expect(answer).toBe(mockAnswer('en', first.sources));
    const tracker = new CitationTracker(first.sources.length);
    tracker.push(answer);
    expect(tracker.citations.map((c) => c.sourceIndex)).toEqual([1, 2]);
    // What it quotes is in the sources, word for word.
    const check = verifyQuotations(answer, first.sources);
    expect(check.checked).toBe(2);
    expect(check.unverified).toEqual([]);
  });

  it('answers in Romanian for a Romanian question', async () => {
    const { deltas, sources } = await run(new MockProvider(), 'ro', 'Împărăția cerurilor');
    const answer = deltas.join('');
    expect(answer).toContain('Răspuns de probă');
    expect(answer).toContain('„');
    expect(verifyQuotations(answer, sources).unverified).toEqual([]);
  });

  it('streams in small pieces, so that markers get cut in two', async () => {
    const { deltas } = await run(new MockProvider({ chunkSize: 3 }), 'en', 'kingdom of heaven');
    expect(deltas.length).toBeGreaterThan(20);
    expect(deltas.every((delta) => delta.length <= 3)).toBe(true);
    expect(deltas.some((delta) => delta.includes('[') && !delta.includes(']'))).toBe(true);
  });

  it('reports a made-up usage and no cache activity', async () => {
    const { result } = await run(new MockProvider(), 'en', 'kingdom of heaven');
    expect(result.model).toBe('mock');
    expect(result.stopReason).toBe('end_turn');
    expect(result.providerRequestId).toBe('mock-r1');
    expect(result.usage.inputTokens).toBeGreaterThan(100);
    expect(result.usage.outputTokens).toBeGreaterThan(10);
    expect(result.usage.cacheReadInputTokens).toBe(0);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const generator = new MockProvider().generate({
      requestId: 'r2',
      language: 'en',
      question: 'q',
      system: 's',
      messages: [],
      sources: buildSources(library, retrieve(library, 'kingdom', { language: 'en' }), 'en'),
      signal: controller.signal,
    });
    await generator.next();
    controller.abort('client');
    await expect(generator.next()).rejects.toBeDefined();
  });

  it('says there are no passages when it is given none', () => {
    expect(mockAnswer('en', [])).toContain('no passages');
    expect(mockAnswer('ro', [])).toContain('Nu există pasaje');
  });
});
