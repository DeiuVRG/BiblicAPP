import fs from 'node:fs';
import path from 'node:path';

import type { z } from 'zod';

import { UsageError } from '../lib/usage-error';

/** `paragraphs[3].text` style path of a zod issue; the empty path is `(root)`. */
export function formatIssuePath(issuePath: readonly PropertyKey[]): string {
  let text = '';
  for (const key of issuePath) {
    if (typeof key === 'number') text += `[${key}]`;
    else text += text === '' ? String(key) : `.${String(key)}`;
  }
  return text === '' ? '(root)' : text;
}

/** One line per issue, each naming the path of the offending value. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
    .join('\n  ');
}

/** Parses already-loaded JSON, reporting schema errors as a `UsageError` that names the paths. */
export function parseWith<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new UsageError(`${label}:\n  ${formatZodError(result.error)}`);
  return result.data;
}

export function readBytesFile(file: string, label: string): Buffer {
  try {
    return fs.readFileSync(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const reason = code === 'ENOENT' ? 'file not found' : `cannot read (${code ?? 'error'})`;
    throw new UsageError(`${label} ${file}: ${reason}`);
  }
}

export function readTextFile(file: string, label: string): string {
  return readBytesFile(file, label).toString('utf8');
}

/** Names of the `.json` files of a directory, sorted; an absent directory has none. */
export function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

/** `JSON.parse` that reports malformed JSON as a `UsageError` naming `where`. */
export function parseJsonText(text: string, where: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new UsageError(
      `${where}: invalid JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

/** Reads and validates a JSON file; every failure is a `UsageError` naming the file. */
export function readJsonFile<T>(file: string, schema: z.ZodType<T>, label: string): T {
  const where = `${label} ${file}`;
  return parseWith(schema, parseJsonText(readTextFile(file, label), where), where);
}

/** Pretty JSON, two spaces, trailing newline (the format `ingest-text` writes). */
export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Writes a file, creating its directory; never touches anything outside `file`'s directory. */
export function writeTextFile(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export function writeJsonFile(file: string, value: unknown): void {
  writeTextFile(file, jsonText(value));
}

/** Forward-slash form of a path, so that committed reports do not depend on the platform. */
export function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}
