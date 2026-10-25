import type { ReactNode } from 'react';
import type { Dataset } from './dataset';

export interface Range {
  /** First index, inclusive. */
  start: number;
  /** Last index, exclusive. */
  end: number;
}

/**
 * - `loaded`: `item` is defined.
 * - `pending`: client only. The item's range isn't in the dataset's `items` yet.
 * - `missing`: server only. `queryFn` (or `items`) had no item at this index.
 * - `error`: server only. `queryFn` threw for the chunk containing this index.
 */
export type ItemStatus = 'loaded' | 'pending' | 'missing' | 'error';

/**
 * `item` is defined when `status` is "loaded". (A narrowing signature would force
 * every consumer to declare all three parameters, so this one doesn't narrow.)
 */
export type RenderItem<T> = (item: T | undefined, index: number, status: ItemStatus) => ReactNode;

export interface ItemsProps<T> {
  data: Dataset<T>;
  /** Renders one item. Don't call hooks here; put them in the components it returns. */
  children: RenderItem<T>;
  /** Client tree: called after the visible range changes. Load data here. */
  onRangeChange?: (range: Range) => void;
}

export function indicesOf({ start, end }: Range): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, k) => start + k);
}
