import { parseArgs } from 'node:util';
import type { ParseArgsOptionsConfig } from 'node:util';

import { UsageError } from './usage-error';

/** `parseArgs` that reports unknown options and malformed values as a `UsageError`. */
export function parseCommandArgs<const O extends ParseArgsOptionsConfig>(args: string[], options: O) {
  try {
    return parseArgs({ args, allowPositionals: true, options });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error), true);
  }
}

/** Parses a strictly positive or non-negative integer option. */
export function parseIntegerOption(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new UsageError(`--${name} expects a whole number, got "${value}"`);
  const parsed = Number.parseInt(value, 10);
  if (parsed < minimum) throw new UsageError(`--${name} must be at least ${minimum}, got ${parsed}`);
  return parsed;
}

/**
 * Runs a command body and maps a `UsageError` to exit code 2. Other errors propagate to the
 * CLI entry point.
 */
export async function runCommand(
  name: string,
  usage: string,
  body: () => Promise<number> | number,
): Promise<number> {
  try {
    return await body();
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`${name}: ${error.message}\n`);
    if (error.showUsage) process.stderr.write(`\n${usage}`);
    return 2;
  }
}
