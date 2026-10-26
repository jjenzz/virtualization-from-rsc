import { cache } from 'react';
import type { Dataset } from './dataset';
import type { Layout } from './layout';

/** What server parts need from their `Root`: its dataset and layout values. */
export type ListEntry<T> = {
  dataset: Dataset<T>;
  /** Total items, across all groups. */
  count: number;
  layout: Layout;
  rangeSize: number;
  /** Runs a fetch within the list's concurrency limit, shared by all of its `Items` (one per group). */
  limit: <R>(fetch: () => Promise<R>) => Promise<R>;
};

/** A limit on how many `getItems` calls a list runs at once, across all of its parts. */
export function createLimit(concurrency: number): ListEntry<unknown>['limit'] {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async (fetch) => {
    if (running >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try {
      return await fetch();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

/**
 * Server Components have no context, so server parts find their list by
 * `Root`'s `id` instead (parts that read the data, `Items` and `Groups`, pass it as `rootId`). `cache()` gives each request its own map, so lists from
 * different requests never mix. Server `Root` registers; server parts look up.
 * Only a reference to the dataset is stored, never its items.
 */
const lists = cache(() => new Map<string, ListEntry<unknown>>());

export function registerList(id: string, entry: ListEntry<unknown>) {
  const registered = lists();
  const existing = registered.get(id);
  if (existing && existing.dataset !== entry.dataset && process.env.NODE_ENV !== 'production') {
    console.error(
      `<VirtualList.Root id="${id}"> is used by more than one list in this request. ` +
        'Give each list its own id, or parts will read the wrong data.',
    );
  }
  registered.set(id, entry);
}

export function getList<T>(rootId: string | undefined, part: string): ListEntry<T> {
  if (!rootId) {
    throw new Error(
      `<VirtualList.${part}> in a Server Component needs rootId, matching its <VirtualList.Root id>. ` +
        "Server Components can't read Root's data through context.",
    );
  }
  const entry = lists().get(rootId);
  if (!entry) {
    throw new Error(
      `<VirtualList.${part} rootId="${rootId}"> found no <VirtualList.Root id="${rootId}" data={…}> ` +
        'rendered before it in this request.',
    );
  }
  return entry as ListEntry<T>;
}
