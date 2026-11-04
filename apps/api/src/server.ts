import { ConfigError, loadConfig } from './config';
import { startServer } from './main';

// Entry point of `node dist/server.js` and `tsx watch src/server.ts`.

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

const running = await startServer(config);

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    running
      .shutdown(signal)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        process.stderr.write(`shutdown failed: ${String(error)}\n`);
        process.exit(1);
      });
  });
}

process.on('unhandledRejection', (reason) => {
  process.stderr.write(
    `${JSON.stringify({ level: 'error', msg: 'unhandledRejection', reason: String(reason) })}\n`,
  );
  process.exit(1);
});
