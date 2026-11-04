/** Tracks the requests in flight so that a shutdown can wait for them, then cut them off. */
export class Lifecycle {
  private shuttingDown = false;
  private active = 0;
  private waiters: Array<() => void> = [];
  private readonly controller = new AbortController();

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /** Aborted (with the reason `'shutdown'`) when the grace period is over. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get inFlight(): number {
    return this.active;
  }

  /** Marks a long request (an answer stream) as started; call the returned function when it ends. */
  begin(): () => void {
    this.active += 1;
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      this.active -= 1;
      if (this.active === 0) {
        const waiters = this.waiters;
        this.waiters = [];
        for (const wake of waiters) wake();
      }
    };
  }

  startShutdown(): void {
    this.shuttingDown = true;
  }

  /** Resolves `true` when nothing is in flight, `false` when the timeout hits first. */
  drain(timeoutMs: number): Promise<boolean> {
    if (this.active === 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.waiters.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  /** Cuts off whatever is still running. */
  abortAll(): void {
    if (!this.controller.signal.aborted) this.controller.abort('shutdown');
  }
}
