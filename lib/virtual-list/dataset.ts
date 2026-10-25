import type { Range } from './types';

export const DEFAULT_RANGE_SIZE = 50;

export type QueryFn<T> = (range: Range, options?: { signal?: AbortSignal }) => Promise<T[]> | T[];

/**
 * Describes the items for <VirtualList.Items>. Usable in client and server code.
 * Has either `items` or `queryFn`, never both:
 * - `items`: data you already have, by range number (range `r` holds indices
 *   `r * rangeSize` up to `(r + 1) * rangeSize`).
 * - `queryFn`: how to fetch a range. The server list calls it while it streams. The
 *   client list never calls it; the app can call `dataset.queryFn(range)` itself.
 *
 * Class instances can't be passed as props from a Server Component to a client
 * component, so build the dataset where it's rendered.
 */
export class Dataset<T> {
  readonly count: number;
  readonly rangeSize: number;
  readonly items: Record<number, T[] | undefined>;
  readonly queryFn?: QueryFn<T>;

  constructor(options: DatasetOptions<T>) {
    this.count = options.count;
    this.rangeSize = options.rangeSize ?? DEFAULT_RANGE_SIZE;
    this.items = options.items ?? {};
    this.queryFn = options.queryFn;
  }

  /** The item at `index`, or undefined if its range isn't in `items`. */
  itemAt(index: number): T | undefined {
    return this.items[Math.floor(index / this.rangeSize)]?.[index % this.rangeSize];
  }
}

type ItemsByRange<T> = Record<number, T[] | undefined>;

/** Either `items` or `queryFn`, not both. */
export type DatasetOptions<T> = { count: number; rangeSize?: number } & (
  { items: ItemsByRange<T>; queryFn?: never } | { queryFn: QueryFn<T>; items?: never }
);

export function createDataset<T>(options: DatasetOptions<T>): Dataset<T> {
  return new Dataset(options);
}
