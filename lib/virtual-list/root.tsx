'use client';

import { createContext, useContext, useMemo, type ComponentProps } from 'react';
import { createDataset, type Dataset, type DatasetInput } from './dataset';
import type { Range } from './types';
import { useVirtualizer, type Virtualizer, type VirtualizerState } from './use-virtualizer';

/** Settings and callbacks. Doesn't change on scroll, so `Item` and `Viewport` don't re-render. */
const VirtualizerContext = createContext<Virtualizer | null>(null);

/** Sizes and the rendered range. Changes when the range does or a row is measured, not on every scroll event. */
const StateContext = createContext<VirtualizerState | null>(null);

/** The dataset from `Root`'s `data`. Client only: Server Components can't read context. */
const DataContext = createContext<Dataset<unknown> | null>(null);

const MISSING_ROOT = 'VirtualList parts must be rendered inside <VirtualList.Root>.';

export function useVirtualizerContext() {
  const context = useContext(VirtualizerContext);
  if (!context) throw new Error(MISSING_ROOT);
  return context;
}

export function useVirtualizerStateContext() {
  const context = useContext(StateContext);
  if (!context) throw new Error(MISSING_ROOT);
  return context;
}

export function useDataContext<T>(): Dataset<T> {
  const context = useContext(DataContext);
  if (!context) throw new Error('<VirtualList.Items> needs <VirtualList.Root data={…}>.');
  return context as Dataset<T>;
}

export interface RootProps extends ComponentProps<'div'> {
  /**
   * The items to render: anything `createDataset` accepts (a dataset, an items
   * array, or `{ items }` / `{ getItems }`). Client parts read it from context.
   */
  data?: DatasetInput<any>;
  /**
   * The index of the first item in `data`. Set it when `data` holds only the
   * window being rendered (e.g. the loaded pages around the visible range).
   * Defaults to the dataset's own offset (0 unless it was made with one).
   */
  offset?: number;
  /**
   * The root element's id. In a Server Component it also links the parts that read
   * this `Root`'s data (`Items`, `Groups`) to it: they pass it as `rootId`, because
   * Server Components can't read context. Unique within the page.
   */
  id?: string;
  /**
   * How many items there are: a number, or for a grouped list one number per group
   * (in order; the total is their sum). Optional for a complete items array (its length).
   */
  count?: number | readonly number[];
  /** Height of every item, in px (controlled). Use this or `defaultItemSize`. */
  itemSize?: number;
  /**
   * Height of items until they're measured, in px (uncontrolled). Items size
   * themselves and are measured as they render. Use this or `itemSize`.
   */
  defaultItemSize?: number;
  /** Extra items rendered above and below the visible range. */
  overscan?: number;
  /**
   * The page size: ranges passed to `onRangeChange` are whole pages of this size,
   * and this many items render before the viewport is measured. Make it at least
   * the number of visible rows. Default 50.
   */
  rangeSize?: number;
  /**
   * Client only: called with the range to load when it changes. While the scrollbar
   * is dragged, a range is reported once the thumb settles in it (120 ms), at least
   * every 400 ms, and on release. The range is snapped so the same rows always give
   * the same range, which makes it a good cache key: it starts at the page (of
   * `rangeSize` items) holding the first visible row and spans enough whole pages to
   * cover the viewport from anywhere in that page (usually two). It only changes
   * when the first visible row moves into another page.
   */
  onRangeChange?: (range: Range) => void;
}

/** The list: `useVirtualizer` for the rows, shared with its parts through context. */
export function Root({
  data,
  offset,
  count,
  itemSize,
  defaultItemSize,
  overscan,
  rangeSize,
  onRangeChange,
  ...props
}: RootProps) {
  const dataset = useMemo(() => (data === undefined ? null : createDataset(data, { offset })), [data, offset]);
  const countValue = count ?? dataset?.defaultCount;
  if (countValue === undefined) {
    throw new Error('<VirtualList.Root> needs count (or data it can be worked out from, like an items array).');
  }
  const { virtualizer, state } = useVirtualizer({
    count: countValue,
    itemSize,
    defaultItemSize,
    overscan,
    rangeSize,
    onRangeChange,
  });

  return (
    <VirtualizerContext value={virtualizer}>
      <StateContext value={state}>
        <DataContext value={dataset}>
          <div {...props} />
        </DataContext>
      </StateContext>
    </VirtualizerContext>
  );
}
