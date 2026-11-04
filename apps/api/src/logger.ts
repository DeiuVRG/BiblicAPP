import type { LogLevel } from './config';

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export interface LoggerOptions {
  level: LogLevel;
  /** Receives one JSON document per call (no trailing newline). Defaults to stdout. */
  write?: (line: string) => void;
  now?: () => Date;
  base?: LogFields;
}

function serialiseError(error: Error): LogFields {
  const out: LogFields = { name: error.name, message: error.message };
  if (error.stack !== undefined) out.stack = error.stack;
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number') out.status = status;
  return out;
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) return serialiseError(value);
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/** Structured JSON logs, one object per line (the format Fly.io and most log shippers expect). */
export function createLogger(options: LoggerOptions): Logger {
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const now = options.now ?? (() => new Date());
  const threshold = ORDER[options.level];
  const base = options.base ?? {};

  const emit = (level: Exclude<LogLevel, 'silent'>, msg: string, fields?: LogFields): void => {
    if (ORDER[level] < threshold) return;
    write(JSON.stringify({ level, time: now().toISOString(), msg, ...base, ...fields }, replacer));
  };

  return {
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
    child: (fields) => createLogger({ ...options, base: { ...base, ...fields } }),
  };
}

/** A logger that discards everything (tests). */
export const silentLogger: Logger = createLogger({ level: 'silent', write: () => undefined });
