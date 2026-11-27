let factory: () => string = () => Math.random().toString(36).slice(2, 10);

export function createId(): string {
  return factory();
}

/** Test hook. Restores the previous factory when `run` returns. */
export function withIds<T>(next: () => string, run: () => T): T {
  const prev = factory;
  factory = next;
  try {
    return run();
  } finally {
    factory = prev;
  }
}
