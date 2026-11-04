import path from 'node:path';

/**
 * Resolves a user-supplied path. Relative paths are resolved against the directory the user
 * started the command from (`INIT_CWD`, set by pnpm) so that `pnpm --filter ... cli` accepts
 * paths relative to where it was typed, not relative to the package directory.
 */
export function resolveUserPath(input: string): string {
  if (path.isAbsolute(input)) return input;
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), input);
}
