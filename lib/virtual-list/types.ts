import type { ReactNode } from 'react';

export interface Range {
  /** First index, inclusive. */
  start: number;
  /** Last index, exclusive. */
  end: number;
}

/**
 * - `loaded`: `item` is defined.
 * - `pending`: the item isn't loaded yet. Client: its range isn't in the dataset's
 *   `items`. Server (streaming or loading on scroll): `children` is called once with
 *   index -1 to render the placeholder shown for every row not loaded yet.
 * - `missing`: server only. `getItems` returned no item for this index (it returned
 *   fewer items than the range asked for).
 * - `error`: server only. `getItems` threw for the chunk containing this index. Also
 *   called once with index -1 to render the row shown when the stream or a request
 *   fails before a row arrives.
 */
export type ItemStatus = 'loaded' | 'pending' | 'missing' | 'error';

/**
 * Renders one item. `item` is defined exactly when `status` is "loaded", so check
 * `item` to narrow it (`status` doesn't narrow `item`: a signature that did would
 * reject callbacks with fewer than three parameters). Pass the item type on the
 * tag, `<VirtualList.Items<User>>`.
 */
export type RenderItem<T> = (item: T | undefined, index: number, status: ItemStatus) => ReactNode;

export interface ItemsProps<T> {
  /**
   * Server Components only: the `id` of the `Root` whose `data` to render.
   * Client components read the data from `Root` through context and ignore this.
   */
  rootId?: string;
  /**
   * Renders one item. Don't call hooks here; put them in the components it returns.
   * The item type can't be inferred from `Root`'s data, so pass it on the tag:
   * `<VirtualList.Items<User>>`.
   */
  children: RenderItem<T>;
}

/** Default for `Root`'s `rangeSize`. */
export const DEFAULT_RANGE_SIZE = 50;

export function indicesOf({ start, end }: Range): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k);
}
