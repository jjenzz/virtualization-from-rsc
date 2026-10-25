import { cache } from 'react';
import type { Dataset } from './dataset';

/** What server parts need from their `Root`: its dataset and layout values. */
export type ListEntry<T> = { dataset: Dataset<T>; count: number; rangeSize: number };

/**
 * Server Components have no context, so server parts find their list by
 * `Root`'s `id` instead (other parts pass it as `rootId`). `cache()` gives each request its own map, so lists from
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
