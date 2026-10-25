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
 *
 * Class instances can't be passed as props from a Server Component to a client
 * component, so build the dataset where it's rendered.
 */
export class Dataset<T> {
  readonly items: readonly (T | undefined)[];
  readonly getItems?: GetItems<T>;
  /** The index of `items[0]`. Set from `Root`'s `offset`. */
  readonly offset: number;

  constructor(options: DatasetOptions<T>, offset = 0) {
    this.items = options.items ?? [];
    this.getItems = options.getItems;
    this.offset = offset;
  }

  /** The item at `index`, or undefined if it's outside the window or not loaded. */
  itemAt(index: number): T | undefined {
    return this.items[index - this.offset];
  }
}

/** Either `items` or `getItems`, not both. `getItems` can return any array of items. */
export type DatasetOptions<T> =
  { items: readonly (T | undefined)[]; getItems?: never } | { getItems: GetItems<T>; items?: never };

/** What `createDataset` and `Root`'s `data` accept: options, an items array, or a dataset. */
export type DatasetInput<T> = DatasetOptions<T> | readonly (T | undefined)[] | Dataset<T>;

/**
 * Makes a dataset from options (`{ items }` or `{ getItems }`), an items array, or
 * another dataset, so datasets compose. `offset` is the index of the first item;
 * when it's left out, a dataset keeps its own offset (0 for a new one). A new
 * dataset made from another shares its `items` or `getItems`. `Root` calls this
 * with its `data` and `offset`.
 */
export function createDataset<T>(input: DatasetInput<T>, { offset }: { offset?: number } = {}): Dataset<T> {
  if (input instanceof Dataset) {
    return new Dataset<T>(
      input.getItems ? { getItems: input.getItems } : { items: input.items },
      offset ?? input.offset,
    );
  }
  if (Array.isArray(input)) return new Dataset<T>({ items: input as readonly (T | undefined)[] }, offset);
  return new Dataset<T>(input as DatasetOptions<T>, offset);
}
