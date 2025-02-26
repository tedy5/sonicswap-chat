export class Mutex {
  private mutex = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const newMutex = new Promise<void>((resolve) => {
      release = resolve;
    });

    const oldMutex = this.mutex;
    this.mutex = newMutex;

    await oldMutex;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

export function createMutex() {
  return new Mutex();
}
