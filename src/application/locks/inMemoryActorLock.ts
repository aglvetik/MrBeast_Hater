export class InMemoryActorLock {
  private readonly inFlight = new Map<string, Promise<void>>();

  public async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.inFlight.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.inFlight.set(
      key,
      previous.then(() => next)
    );
    await previous;

    try {
      return await work();
    } finally {
      release();
      if (this.inFlight.get(key) === next) {
        this.inFlight.delete(key);
      }
    }
  }
}
