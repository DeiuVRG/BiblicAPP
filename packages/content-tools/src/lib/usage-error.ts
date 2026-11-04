/**
 * A mistake in the arguments, in a materials file or in a hand-written input file. Commands
 * turn it into a message on stderr and exit code 2; any other error is a bug and propagates.
 */
export class UsageError extends Error {
  /** True when the one-screen usage text should be printed after the message. */
  readonly showUsage: boolean;

  constructor(message: string, showUsage = false) {
    super(message);
    this.name = 'UsageError';
    this.showUsage = showUsage;
  }
}
