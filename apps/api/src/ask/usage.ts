import type { Usage } from '../types';

/** Running totals of model usage since the process started (also logged at shutdown). */
export class UsageLedger {
  requests = 0;
  inputTokens = 0;
  outputTokens = 0;
  cacheReadInputTokens = 0;
  cacheCreationInputTokens = 0;

  record(usage: Usage): void {
    this.requests += 1;
    this.inputTokens += usage.inputTokens;
    this.outputTokens += usage.outputTokens;
    this.cacheReadInputTokens += usage.cacheReadInputTokens;
    this.cacheCreationInputTokens += usage.cacheCreationInputTokens;
  }

  snapshot(): Record<string, number> {
    return {
      requests: this.requests,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cacheReadInputTokens: this.cacheReadInputTokens,
      cacheCreationInputTokens: this.cacheCreationInputTokens,
    };
  }
}
