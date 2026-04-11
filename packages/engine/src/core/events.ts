type Handler<T> = (payload: T) => void;

export class EventBus<E extends Record<string, unknown>> {
  private listeners = new Map<keyof E, Set<Handler<unknown>>>();

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => {
      set!.delete(handler as Handler<unknown>);
    };
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) (fn as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
