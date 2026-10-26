import type { Range } from './types';

export type GetItems<T> = (range: Range, options?: { signal?: AbortSignal }) => Promise<T[]> | T[];

/**
 * Where the items come from. Usable in client and server code. Has either
 * `items` or `getItems`, never both. Layout values (`count`, `offset`,
 * `rangeSize`) are `Root` props.
 * - `items`: the items being rendered now. Pass all of them, or just the window
 *   your app has loaded for the visible range (with `Root`'s `offset` set to the
 *   window's first index), and keep everything else in your data library's cache.
 *   `undefined` entries, and indices outside the window, are "pending".
 * - `getItems`: a source the server list reads while it renders: given a range,
 *   it returns that range's items. The list doesn't cache or refetch; it reads
 *   each range once. Server only: the client list never calls it (the app loads
 *   data itself and passes `items`).
 * - `groups` (optional): your group objects, in order, passed to `Groups` to render
 *   each group. Their shape is yours: the list never reads them. Items stay flat,
 *   in group order, and the group sizes go on `Root`'s `count`, one per group.
 *
 * Class instances can't be passed as props from a Server Component to a client
 * component, so build the dataset where it's rendered.
 */
export class Dataset<T, G = unknown> {
  readonly items: readonly (T | undefined)[];
  readonly getItems?: GetItems<T>;
  readonly groups?: readonly G[];
  /** The index of `items[0]`. Set from `Root`'s `offset`. */
  readonly offset: number;

  constructor(options: DatasetOptions<T, G>, offset = 0) {
    this.items = options.items ?? [];
    this.getItems = options.getItems;
    this.groups = options.groups;
    this.offset = offset;
  }

  /** The `count` to use when `Root` has none: the length of a flat, complete `items` array. */
  get defaultCount(): number | undefined {
    return !this.getItems && !this.groups && this.offset === 0 ? this.items.length : undefined;
  }

  /** A dataset with the same data and a different offset. */
  withOffset(offset: number): Dataset<T, G> {
    const copy = Object.create(Dataset.prototype) as Dataset<T, G>;
    Object.assign(copy, this, { offset });
    return copy;
  }

  /** The item at `index`, or undefined if it's outside the window or not loaded. */
  itemAt(index: number): T | undefined {
    return this.items[index - this.offset];
  }
}

/** Either `items` or `getItems`, not both, plus optional `groups`. `getItems` can return any array of items. */
export type DatasetOptions<T, G = unknown> =
  | { items: readonly (T | undefined)[]; getItems?: never; groups?: readonly G[] }
  | { getItems: GetItems<T>; items?: never; groups?: readonly G[] };

/** What `createDataset` and `Root`'s `data` accept: options, an items array, or a dataset. */
export type DatasetInput<T, G = unknown> = DatasetOptions<T, G> | readonly (T | undefined)[] | Dataset<T, G>;

/**
 * Makes a dataset from options (`{ items }` or `{ getItems }`), an items array, or
 * another dataset, so datasets compose. `offset` is the index of the first item;
 * when it's left out, a dataset keeps its own offset (0 for a new one). A new
 * dataset made from another shares its `items` or `getItems`. `Root` calls this
 * with its `data` and `offset`.
 */
export function createDataset<T, G = unknown>(
  input: DatasetInput<T, G>,
  { offset }: { offset?: number } = {},
): Dataset<T, G> {
  if (input instanceof Dataset) return input.withOffset(offset ?? input.offset);
  if (Array.isArray(input)) return new Dataset<T, G>({ items: input as readonly (T | undefined)[] }, offset);
  return new Dataset<T, G>(input as DatasetOptions<T, G>, offset);
}
