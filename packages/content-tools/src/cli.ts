#!/usr/bin/env tsx
import { runBuildPack } from './commands/build-pack';
import { runIngestText } from './commands/ingest-text';
import { runKeygen } from './commands/keygen';
import { runVerifyPack } from './commands/verify-pack';

export interface Command {
  summary: string;
  run: (args: string[]) => Promise<number>;
}

export const commands: Record<string, Command> = {
  'ingest-text': {
    summary: 'raw pdftotext output -> canonical work JSON',
    run: runIngestText,
  },
  'build-pack': {
    summary: 'canonical work JSON -> pack.json + manifest.json (hashed and signed)',
    run: runBuildPack,
  },
  'verify-pack': {
    summary: 'verify pack.json against manifest.json (sha256 + Ed25519 signature)',
    run: runVerifyPack,
  },
  keygen: {
    summary: 'generate an Ed25519 keypair (private key goes to content/keys/, gitignored)',
    run: runKeygen,
  },
};

export function usage(): string {
  const lines = Object.entries(commands).map(([name, c]) => `  ${name.padEnd(12)} ${c.summary}`);
  return `Usage: biblioteca-content <command> [options]\n\nCommands:\n${lines.join('\n')}\n`;
}

export async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === '--help' || name === '-h') {
    process.stdout.write(usage());
    return name ? 0 : 1;
  }
  const command = commands[name];
  if (!command) {
    process.stderr.write(`Unknown command: ${name}\n\n${usage()}`);
    return 1;
  }
  return command.run(rest);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
