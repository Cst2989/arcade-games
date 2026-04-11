export type Entity = number;

export interface Component<T> {
  readonly id: symbol;
  readonly name: string;
  readonly _type?: T;
}

export function defineComponent<T>(name: string): Component<T> {
  return { id: Symbol(name), name };
}

export class World {
  // Entity ids are monotonically assigned and never recycled.
  private nextId: Entity = 1;
  private stores = new Map<symbol, Map<Entity, unknown>>();
  private alive = new Set<Entity>();

  spawn(): Entity {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  add<T>(e: Entity, c: Component<T>, value: T): void {
    let store = this.stores.get(c.id);
    if (!store) {
      store = new Map();
      this.stores.set(c.id, store);
    }
    store.set(e, value);
  }

  get<T>(e: Entity, c: Component<T>): T | undefined {
    return this.stores.get(c.id)?.get(e) as T | undefined;
  }

  has<T>(e: Entity, c: Component<T>): boolean {
    return this.stores.get(c.id)?.has(e) ?? false;
  }

  removeComponent<T>(e: Entity, c: Component<T>): void {
    this.stores.get(c.id)?.delete(e);
  }

  remove(e: Entity): void {
    this.alive.delete(e);
    for (const store of this.stores.values()) store.delete(e);
  }

  isAlive(e: Entity): boolean {
    return this.alive.has(e);
  }

  query<A>(a: Component<A>): Iterable<[Entity, A]>;
  query<A, B>(a: Component<A>, b: Component<B>): Iterable<[Entity, A, B]>;
  query<A, B, C>(
    a: Component<A>,
    b: Component<B>,
    c: Component<C>,
  ): Iterable<[Entity, A, B, C]>;
  *query(...comps: Component<unknown>[]): Iterable<unknown[]> {
    const stores = comps.map((c) => this.stores.get(c.id));
    if (stores.some((s) => !s)) return;
    const first = (stores as Map<Entity, unknown>[])[0]!;
    const rest = (stores as Map<Entity, unknown>[]).slice(1);
    outer: for (const [id, v0] of first) {
      const row: unknown[] = [id, v0];
      for (const s of rest) {
        if (!s.has(id)) continue outer;
        row.push(s.get(id));
      }
      yield row;
    }
  }

  size(): number {
    return this.alive.size;
  }
}
