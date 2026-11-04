import { describe, expect, it } from 'vitest';

import { commands, usage } from './cli';

describe('cli', () => {
  it('registers the seven commands', () => {
    expect(Object.keys(commands).sort()).toEqual([
      'build-pack',
      'ingest-text',
      'keygen',
      'translation-check',
      'translation-jobs',
      'translation-merge',
      'verify-pack',
    ]);
  });

  it('lists every command in the usage text', () => {
    const text = usage();
    for (const name of Object.keys(commands)) expect(text).toContain(name);
  });
});
