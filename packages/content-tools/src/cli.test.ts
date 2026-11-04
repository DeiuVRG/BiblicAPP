import { describe, expect, it } from 'vitest';

import { commands, usage } from './cli';

describe('cli', () => {
  it('registers the four commands', () => {
    expect(Object.keys(commands).sort()).toEqual([
      'build-pack',
      'ingest-text',
      'keygen',
      'verify-pack',
    ]);
  });

  it('lists every command in the usage text', () => {
    const text = usage();
    for (const name of Object.keys(commands)) expect(text).toContain(name);
  });
});
