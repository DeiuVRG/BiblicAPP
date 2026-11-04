import { describe, expect, it } from 'vitest';

import {
  ConfigError,
  DEFAULT_ALLOWED_ORIGINS,
  describeConfig,
  loadConfig,
  redactUrl,
} from './config';
import { DEFAULT_KEYS_DIR, DEFAULT_PACKS_DIR } from './paths';

describe('loadConfig defaults', () => {
  const config = loadConfig({});

  it('starts in mock mode without an API key', () => {
    expect(config.provider).toBe('mock');
    expect(config.anthropicApiKey).toBeUndefined();
  });

  it('has the documented defaults', () => {
    expect(config).toMatchObject({
      port: 8787,
      host: '0.0.0.0',
      model: 'claude-sonnet-5-5',
      maxOutputTokens: 1200,
      effort: 'low',
      fallback: 'off',
      providerMaxRetries: 2,
      askDeadlineMs: 120_000,
      trustProxy: 'none',
      accessCodes: [],
      accessCodeBlank: false,
      accessFailureLimit: { capacity: 20, windowMs: 600_000 },
      dailyQuestionCap: 0,
      maxBodyBytes: 65_536,
      requestTimeoutMs: 15_000,
      headersTimeoutMs: 10_000,
      logLevel: 'info',
      shutdownGraceMs: 20_000,
      rateLimit: {
        ask: { capacity: 20, windowMs: 600_000 },
        read: { capacity: 120, windowMs: 60_000 },
      },
    });
    expect(config.packsDir).toBe(DEFAULT_PACKS_DIR);
    expect(config.keysDir).toBe(DEFAULT_KEYS_DIR);
    expect(DEFAULT_PACKS_DIR.endsWith('apps/mobile/assets/packs')).toBe(true);
  });

  it('allows the GitHub Pages site and the Expo web dev server by default', () => {
    expect(config.allowedOrigins).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
    expect(config.allowedOrigins).toContain('https://deiuvrg.github.io');
    expect(config.allowedOrigins).toContain('http://localhost:8081');
  });
});

describe('loadConfig overrides', () => {
  it('reads every setting', () => {
    const config = loadConfig({
      PORT: '9000',
      LISTEN_HOST: '127.0.0.1',
      AI_PROVIDER: 'claude',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: 'http://127.0.0.1:1234',
      MODEL: 'claude-haiku-5-5',
      MAX_OUTPUT_TOKENS: '800',
      MODEL_EFFORT: 'none',
      MODEL_FALLBACK: 'default',
      PROVIDER_TIMEOUT_MS: '30000',
      PROVIDER_MAX_RETRIES: '0',
      ASK_DEADLINE_MS: '90000',
      PACKS_DIR: '/data/packs',
      KEYS_DIR: '/data/keys',
      ALLOWED_ORIGINS: 'https://example.org, http://localhost:3000,HTTPS://Example.org',
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_WINDOW_SECONDS: '60',
      RATE_LIMIT_READ_MAX: '50',
      RATE_LIMIT_READ_WINDOW_SECONDS: '10',
      TRUST_PROXY: 'fly',
      ACCESS_CODE: 'alpha-code, beta-code',
      ACCESS_FAILURE_MAX: '5',
      ACCESS_FAILURE_WINDOW_SECONDS: '120',
      DAILY_QUESTION_CAP: '250',
      MAX_BODY_BYTES: '2048',
      REQUEST_TIMEOUT_MS: '5000',
      HEADERS_TIMEOUT_MS: '2000',
      LOG_LEVEL: 'debug',
      LOG_HASH_SALT: 'a-long-enough-salt',
      SHUTDOWN_GRACE_MS: '1000',
    });
    expect(config).toMatchObject({
      port: 9000,
      host: '127.0.0.1',
      provider: 'claude',
      anthropicApiKey: 'test-key',
      anthropicBaseUrl: 'http://127.0.0.1:1234',
      model: 'claude-haiku-5-5',
      maxOutputTokens: 800,
      effort: null,
      fallback: 'default',
      providerTimeoutMs: 30_000,
      providerMaxRetries: 0,
      askDeadlineMs: 90_000,
      packsDir: '/data/packs',
      keysDir: '/data/keys',
      allowedOrigins: ['https://example.org', 'http://localhost:3000'],
      rateLimit: {
        ask: { capacity: 5, windowMs: 60_000 },
        read: { capacity: 50, windowMs: 10_000 },
      },
      trustProxy: 'fly',
      accessCodes: ['alpha-code', 'beta-code'],
      accessCodeBlank: false,
      accessFailureLimit: { capacity: 5, windowMs: 120_000 },
      dailyQuestionCap: 250,
      maxBodyBytes: 2048,
      requestTimeoutMs: 5000,
      headersTimeoutMs: 2000,
      logLevel: 'debug',
      logHashSalt: 'a-long-enough-salt',
      shutdownGraceMs: 1000,
    });
  });

  it('treats empty variables as unset', () => {
    const config = loadConfig({
      PORT: '',
      ANTHROPIC_API_KEY: '  ',
      AI_PROVIDER: '',
      RATE_LIMIT_MAX: '',
    });
    expect(config.port).toBe(8787);
    expect(config.provider).toBe('mock');
    expect(config.rateLimit.ask.capacity).toBe(20);
  });
});

describe('loadConfig errors', () => {
  const problems = (env: Record<string, string>): string[] => {
    try {
      loadConfig(env);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      return [...(error as ConfigError).issues];
    }
    throw new Error('expected a ConfigError');
  };

  it('asks for the key when the claude provider is chosen', () => {
    expect(problems({ AI_PROVIDER: 'claude' })).toEqual([
      expect.stringContaining('ANTHROPIC_API_KEY: required when AI_PROVIDER=claude'),
    ]);
  });

  it('rejects values of the wrong kind or out of range, naming each variable', () => {
    const issues = problems({
      PORT: 'eighty',
      AI_PROVIDER: 'openai',
      RATE_LIMIT_MAX: '0',
      MAX_OUTPUT_TOKENS: '99999',
      TRUST_PROXY: 'yes',
      ANTHROPIC_BASE_URL: 'not a url',
    });
    for (const name of [
      'PORT',
      'AI_PROVIDER',
      'RATE_LIMIT_MAX',
      'MAX_OUTPUT_TOKENS',
      'TRUST_PROXY',
      'ANTHROPIC_BASE_URL',
    ]) {
      expect(
        issues.some((issue) => issue.startsWith(`${name}:`)),
        name,
      ).toBe(true);
    }
  });

  it('rejects origins that are not plain origins', () => {
    const issues = problems({
      ALLOWED_ORIGINS: 'https://ok.example, *, https://x.example/path, example.org',
    });
    expect(issues).toHaveLength(3);
    expect(issues.join('\n')).toContain('"*"');
    expect(issues.join('\n')).toContain('https://x.example/path');
    expect(issues.join('\n')).toContain('example.org');
  });

  it('lists every kind of problem at once, whichever check finds it', () => {
    // A schema error (PORT) must not hide the checks that look at several variables: the missing
    // key for the claude provider, a bad origin, credentials in a URL, and the two timeouts.
    const issues = problems({
      PORT: 'abc',
      AI_PROVIDER: 'claude',
      ALLOWED_ORIGINS: 'https://ok.example, https://x.example/path',
      ANTHROPIC_BASE_URL: 'https://user:pass@proxy.example/v1',
      REQUEST_TIMEOUT_MS: '1000',
      HEADERS_TIMEOUT_MS: '5000',
    });
    for (const name of [
      'PORT',
      'ANTHROPIC_API_KEY',
      'ALLOWED_ORIGINS',
      'ANTHROPIC_BASE_URL',
      'HEADERS_TIMEOUT_MS',
    ]) {
      expect(
        issues.some((issue) => issue.startsWith(`${name}:`)),
        `${name} in ${JSON.stringify(issues)}`,
      ).toBe(true);
    }
    // And the other order: a bad origin does not hide a schema error either.
    const reverse = problems({
      ALLOWED_ORIGINS: '*',
      MAX_OUTPUT_TOKENS: '1',
      MODEL_EFFORT: 'huge',
    });
    expect(reverse.some((issue) => issue.startsWith('ALLOWED_ORIGINS:'))).toBe(true);
    expect(reverse.some((issue) => issue.startsWith('MAX_OUTPUT_TOKENS:'))).toBe(true);
    expect(reverse.some((issue) => issue.startsWith('MODEL_EFFORT:'))).toBe(true);
  });

  it('refuses a headers timeout longer than the request timeout (Node would throw)', () => {
    expect(problems({ REQUEST_TIMEOUT_MS: '2000', HEADERS_TIMEOUT_MS: '3000' })).toEqual([
      expect.stringContaining('HEADERS_TIMEOUT_MS: must not be larger than REQUEST_TIMEOUT_MS'),
    ]);
    expect(() =>
      loadConfig({ REQUEST_TIMEOUT_MS: '3000', HEADERS_TIMEOUT_MS: '3000' }),
    ).not.toThrow();
  });

  it('reads the access codes: one or several, trimmed, without duplicates', () => {
    expect(loadConfig({ ACCESS_CODE: 'one-code' }).accessCodes).toEqual(['one-code']);
    expect(loadConfig({ ACCESS_CODE: ' a1 ,b2,,  c3 , a1 ' }).accessCodes).toEqual([
      'a1',
      'b2',
      'c3',
    ]);
    // Empty counts as unset: the beta is open.
    expect(loadConfig({ ACCESS_CODE: '' }).accessCodes).toEqual([]);
    expect(loadConfig({ ACCESS_CODE: '   ' }).accessCodes).toEqual([]);
    expect(loadConfig({ ACCESS_CODE: 'x'.repeat(128) }).accessCodes).toHaveLength(1);
  });

  it('notes an ACCESS_CODE that is set but empty: an open beta that nobody asked for, most likely', () => {
    // Empty counts as unset (the beta is open), but the difference between "never set" and "set to
    // nothing" is kept, so that start-up can warn about the second (`access.open`).
    for (const blank of ['', '   ', '\t']) {
      const config = loadConfig({ ACCESS_CODE: blank });
      expect(config.accessCodes, JSON.stringify(blank)).toEqual([]);
      expect(config.accessCodeBlank, JSON.stringify(blank)).toBe(true);
    }
    expect(loadConfig({}).accessCodeBlank).toBe(false);
    expect(loadConfig({ ACCESS_CODE: 'one-code' }).accessCodeBlank).toBe(false);
    // A value of only separators is still an error, not a blank: it was written on purpose.
    expect(() => loadConfig({ ACCESS_CODE: ',' })).toThrow(ConfigError);
  });

  it('keeps the allowance of wrong codes within sane bounds', () => {
    for (const [name, bad] of [
      ['ACCESS_FAILURE_MAX', '0'],
      ['ACCESS_FAILURE_MAX', '-1'],
      ['ACCESS_FAILURE_MAX', '1.5'],
      ['ACCESS_FAILURE_MAX', 'many'],
      ['ACCESS_FAILURE_MAX', '100001'],
      ['ACCESS_FAILURE_WINDOW_SECONDS', '0'],
      ['ACCESS_FAILURE_WINDOW_SECONDS', '86401'],
      ['ACCESS_FAILURE_WINDOW_SECONDS', 'soon'],
    ] as const) {
      expect(
        problems({ [name]: bad }).some((issue) => issue.startsWith(`${name}:`)),
        `${name}=${bad}`,
      ).toBe(true);
    }
    expect(loadConfig({ ACCESS_FAILURE_MAX: '1' }).accessFailureLimit.capacity).toBe(1);
    expect(loadConfig({ ACCESS_FAILURE_MAX: '' }).accessFailureLimit.capacity).toBe(20);
    expect(loadConfig({ ACCESS_FAILURE_WINDOW_SECONDS: '86400' }).accessFailureLimit.windowMs).toBe(
      86_400_000,
    );
  });

  it('refuses access codes that cannot travel in a header, without repeating them', () => {
    for (const bad of ['has space in it', 'tab\tcode', 'accént-code', 'x'.repeat(129)]) {
      const issues = problems({ ACCESS_CODE: bad });
      expect(issues, bad).toEqual([expect.stringContaining('ACCESS_CODE:')]);
      expect(issues.join('\n'), bad).not.toContain(bad);
    }
    // One bad code among good ones is still a mistake.
    expect(problems({ ACCESS_CODE: 'good-code, bad code' })).toHaveLength(1);
    // A value that lists no code must not quietly leave the beta open.
    expect(problems({ ACCESS_CODE: ' , ,' })).toEqual([
      expect.stringContaining('ACCESS_CODE: lists no code'),
    ]);
  });

  it('refuses a daily cap that is not a whole number of questions', () => {
    for (const bad of ['-1', '1.5', 'many', '1000001']) {
      expect(
        problems({ DAILY_QUESTION_CAP: bad }).some((issue) =>
          issue.startsWith('DAILY_QUESTION_CAP:'),
        ),
        bad,
      ).toBe(true);
    }
    expect(loadConfig({ DAILY_QUESTION_CAP: '0' }).dailyQuestionCap).toBe(0);
    expect(loadConfig({ DAILY_QUESTION_CAP: '' }).dailyQuestionCap).toBe(0);
  });

  it('lists all problems at once in the error message and never prints the key', () => {
    try {
      loadConfig({
        AI_PROVIDER: 'claude',
        ANTHROPIC_API_KEY: 'super-secret-key-value',
        ALLOWED_ORIGINS: 'bad origin',
      });
      throw new Error('expected a ConfigError');
    } catch (error) {
      expect((error as Error).message).toContain('Invalid configuration');
      expect((error as Error).message).not.toContain('super-secret-key-value');
    }
  });
});

describe('describeConfig', () => {
  it('hides secrets', () => {
    const text = JSON.stringify(
      describeConfig(
        loadConfig({
          AI_PROVIDER: 'claude',
          ANTHROPIC_API_KEY: 'super-secret-key-value',
          LOG_HASH_SALT: 'salt-salt-salt',
        }),
      ),
    );
    expect(text).not.toContain('super-secret-key-value');
    expect(text).not.toContain('salt-salt-salt');
    expect(text).toContain('"anthropicApiKeySet":true');
  });

  it('hides the access codes and says only whether the beta is closed', () => {
    const shown = describeConfig(loadConfig({ ACCESS_CODE: 'tester-code-1234, other-code-5678' }));
    const text = JSON.stringify(shown);
    expect(text).not.toContain('tester-code-1234');
    expect(text).not.toContain('other-code-5678');
    expect(shown).not.toHaveProperty('accessCodes');
    expect(shown.accessCodeCount).toBe(2);
    expect(describeConfig(loadConfig({})).accessCodeCount).toBe(0);
  });

  it('shows that an empty ACCESS_CODE was seen, and the allowance of wrong codes', () => {
    const shown = describeConfig(loadConfig({ ACCESS_CODE: '  ', ACCESS_FAILURE_MAX: '7' }));
    expect(shown).toMatchObject({
      accessCodeCount: 0,
      accessCodeBlank: true,
      accessFailureLimit: { capacity: 7, windowMs: 600_000 },
    });
  });

  it('shows the base URL of the model API without user info, query or fragment', () => {
    // fetch() refuses a URL with credentials, and loadConfig refuses one too; describeConfig still
    // strips what could carry a secret, for configs built by hand.
    const config = loadConfig({
      ANTHROPIC_BASE_URL: 'https://proxy.example:8443/anthropic?token=abc#frag',
    });
    const shown = describeConfig(config);
    expect(shown.anthropicBaseUrl).toBe('https://proxy.example:8443/anthropic');
    expect(JSON.stringify(shown)).not.toContain('token=abc');
    expect(redactUrl('https://user:secret@host.example/v1?key=1')).toBe('https://host.example/v1');
    expect(redactUrl('not a url')).toBe('(not a valid URL)');
    expect(describeConfig(loadConfig({})).anthropicBaseUrl).toBeUndefined();
  });
});
