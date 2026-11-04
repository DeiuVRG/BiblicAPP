import { z } from 'zod';

import { DEFAULT_KEYS_DIR, DEFAULT_PACKS_DIR } from './paths';

export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'https://deiuvrg.github.io',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];

export type ClaudeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type TrustProxy = 'none' | 'fly' | 'xff';

const ORIGIN = /^https?:\/\/[^/\s?#]+$/i;

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_HEADERS_TIMEOUT_MS = 10_000;

function intInRange(min: number, max: number, fallback: number) {
  return z.coerce.number().int().min(min).max(max).default(fallback);
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: intInRange(0, 65535, 8787),
  LISTEN_HOST: z.string().min(1).default('0.0.0.0'),

  AI_PROVIDER: z.enum(['mock', 'claude']).default('mock'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_BASE_URL: z.url().optional(),
  MODEL: z.string().min(1).default('claude-sonnet-5-5'),
  MAX_OUTPUT_TOKENS: intInRange(64, 8000, 1200),
  /** `none` leaves `output_config.effort` out (models that do not support it). */
  MODEL_EFFORT: z.enum(['none', 'low', 'medium', 'high', 'xhigh', 'max']).default('low'),
  /** `default` asks the API for its server-side refusal fallback (beta). */
  MODEL_FALLBACK: z.enum(['off', 'default']).default('off'),
  PROVIDER_TIMEOUT_MS: intInRange(1000, 600_000, 60_000),
  PROVIDER_MAX_RETRIES: intInRange(0, 6, 2),
  ASK_DEADLINE_MS: intInRange(100, 600_000, 120_000),

  PACKS_DIR: z.string().min(1).default(DEFAULT_PACKS_DIR),
  KEYS_DIR: z.string().min(1).default(DEFAULT_KEYS_DIR),

  ALLOWED_ORIGINS: z.string().default(DEFAULT_ALLOWED_ORIGINS.join(',')),

  RATE_LIMIT_MAX: intInRange(1, 100_000, 20),
  RATE_LIMIT_WINDOW_SECONDS: intInRange(1, 86_400, 600),
  RATE_LIMIT_READ_MAX: intInRange(1, 100_000, 120),
  RATE_LIMIT_READ_WINDOW_SECONDS: intInRange(1, 86_400, 60),
  TRUST_PROXY: z.enum(['none', 'fly', 'xff']).default('none'),

  MAX_BODY_BYTES: intInRange(1024, 1_048_576, 65_536),
  /** Time a client gets to send a whole request (headers and body); slower senders are cut off (408). */
  REQUEST_TIMEOUT_MS: intInRange(100, 300_000, DEFAULT_REQUEST_TIMEOUT_MS),
  /** Time a client gets to send the request headers; must not exceed REQUEST_TIMEOUT_MS. */
  HEADERS_TIMEOUT_MS: intInRange(100, 120_000, DEFAULT_HEADERS_TIMEOUT_MS),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  /** Salt for the hashes that stand in for question text and client IPs in logs. */
  LOG_HASH_SALT: z.string().min(8).optional(),
  SHUTDOWN_GRACE_MS: intInRange(0, 120_000, 20_000),
});

/** Every environment variable the service reads (kept in step with `.env.example` and the docs by a test). */
export const ENV_NAMES: readonly string[] = Object.keys(EnvSchema.shape);

export interface RateLimitConfig {
  capacity: number;
  windowMs: number;
}

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  provider: 'mock' | 'claude';
  /** Present when `provider` is `claude`. Never log this object without `describeConfig`. */
  anthropicApiKey?: string;
  anthropicBaseUrl?: string;
  model: string;
  maxOutputTokens: number;
  /** `null` when MODEL_EFFORT=none. */
  effort: ClaudeEffort | null;
  fallback: 'off' | 'default';
  providerTimeoutMs: number;
  providerMaxRetries: number;
  askDeadlineMs: number;
  packsDir: string;
  keysDir: string;
  allowedOrigins: string[];
  rateLimit: { ask: RateLimitConfig; read: RateLimitConfig };
  trustProxy: TrustProxy;
  maxBodyBytes: number;
  requestTimeoutMs: number;
  headersTimeoutMs: number;
  logLevel: LogLevel;
  logHashSalt?: string;
  shutdownGraceMs: number;
}

export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

function parseOrigins(raw: string): { origins: string[]; problems: string[] } {
  const origins: string[] = [];
  const problems: string[] = [];
  for (const part of raw.split(',')) {
    const origin = part.trim();
    if (origin === '') continue;
    if (!ORIGIN.test(origin)) {
      problems.push(
        `ALLOWED_ORIGINS: "${origin}" is not an origin (expected scheme://host[:port], no path, no trailing slash, no wildcard)`,
      );
      continue;
    }
    const normalised = origin.toLowerCase();
    if (!origins.includes(normalised)) origins.push(normalised);
  }
  return { origins, problems };
}

/** A URL with everything that could carry a secret removed: no user info, query or fragment. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '(not a valid URL)';
  }
}

function hasCredentials(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.username !== '' || parsed.password !== '';
  } catch {
    return false;
  }
}

/**
 * Reads and validates the process environment. Empty variables count as unset. Throws a
 * `ConfigError` that lists every problem at once (a mistake in one variable does not hide a
 * mistake in another); the messages never contain secret values.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const present: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value.trim() !== '') present[key] = value.trim();
  }
  const parsed = EnvSchema.safeParse(present);
  const issues: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = issue.path.length > 0 ? issue.path.join('.') : 'environment';
      issues.push(`${name}: ${issue.message}`);
    }
  }
  // The checks that look at several variables, or at the raw text of one, run on the raw values
  // too, so that a schema error does not hide them.
  const provider = parsed.success ? parsed.data.AI_PROVIDER : present.AI_PROVIDER;
  if (provider === 'claude' && present.ANTHROPIC_API_KEY === undefined) {
    issues.push(
      'ANTHROPIC_API_KEY: required when AI_PROVIDER=claude (use AI_PROVIDER=mock to run without it)',
    );
  }
  if (present.ANTHROPIC_BASE_URL !== undefined && hasCredentials(present.ANTHROPIC_BASE_URL)) {
    issues.push(
      'ANTHROPIC_BASE_URL: must not contain a user name or password (the key is ANTHROPIC_API_KEY)',
    );
  }
  const origins = parseOrigins(present.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(','));
  issues.push(...origins.problems);
  const requestTimeout = Number(present.REQUEST_TIMEOUT_MS ?? DEFAULT_REQUEST_TIMEOUT_MS);
  const headersTimeout = Number(present.HEADERS_TIMEOUT_MS ?? DEFAULT_HEADERS_TIMEOUT_MS);
  if (headersTimeout > requestTimeout) {
    issues.push('HEADERS_TIMEOUT_MS: must not be larger than REQUEST_TIMEOUT_MS');
  }
  if (!parsed.success || issues.length > 0) throw new ConfigError(issues);
  const values = parsed.data;

  const config: Config = {
    env: values.NODE_ENV,
    port: values.PORT,
    host: values.LISTEN_HOST,
    provider: values.AI_PROVIDER,
    model: values.MODEL,
    maxOutputTokens: values.MAX_OUTPUT_TOKENS,
    effort: values.MODEL_EFFORT === 'none' ? null : values.MODEL_EFFORT,
    fallback: values.MODEL_FALLBACK,
    providerTimeoutMs: values.PROVIDER_TIMEOUT_MS,
    providerMaxRetries: values.PROVIDER_MAX_RETRIES,
    askDeadlineMs: values.ASK_DEADLINE_MS,
    packsDir: values.PACKS_DIR,
    keysDir: values.KEYS_DIR,
    allowedOrigins: origins.origins,
    rateLimit: {
      ask: { capacity: values.RATE_LIMIT_MAX, windowMs: values.RATE_LIMIT_WINDOW_SECONDS * 1000 },
      read: {
        capacity: values.RATE_LIMIT_READ_MAX,
        windowMs: values.RATE_LIMIT_READ_WINDOW_SECONDS * 1000,
      },
    },
    trustProxy: values.TRUST_PROXY,
    maxBodyBytes: values.MAX_BODY_BYTES,
    requestTimeoutMs: values.REQUEST_TIMEOUT_MS,
    headersTimeoutMs: values.HEADERS_TIMEOUT_MS,
    logLevel: values.LOG_LEVEL,
    shutdownGraceMs: values.SHUTDOWN_GRACE_MS,
  };
  if (values.ANTHROPIC_API_KEY !== undefined) config.anthropicApiKey = values.ANTHROPIC_API_KEY;
  if (values.ANTHROPIC_BASE_URL !== undefined) config.anthropicBaseUrl = values.ANTHROPIC_BASE_URL;
  if (values.LOG_HASH_SALT !== undefined) config.logHashSalt = values.LOG_HASH_SALT;
  return config;
}

/** The configuration as it may be logged: secrets replaced by a flag, URLs without user info or query. */
export function describeConfig(config: Config): Record<string, unknown> {
  const { anthropicApiKey, logHashSalt, anthropicBaseUrl, ...rest } = config;
  return {
    ...rest,
    ...(anthropicBaseUrl !== undefined ? { anthropicBaseUrl: redactUrl(anthropicBaseUrl) } : {}),
    anthropicApiKeySet: anthropicApiKey !== undefined,
    logHashSaltSet: logHashSalt !== undefined,
  };
}
