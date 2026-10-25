'use client';

import { createContext, useContext, useEffect, useEffectEvent, useMemo, useState, type ComponentProps } from 'react';
import { createDataset, type Dataset, type DatasetInput } from './dataset';
import { DEFAULT_RANGE_SIZE, type Range } from './types';

/** Settings and setters. Doesn't change on scroll, so `Item` and `Viewport` don't re-render. */
type RootContextValue = {
  count: number;
  itemSize: number;
  rangeSize: number;
  setScrollTop: (value: number) => void;
  setViewportHeight: (value: number) => void;
};

const RootContext = createContext<RootContextValue | null>(null);

/**
 * The visible range, or `null` until the viewport is measured (server render,
 * hydration). Only changes when the range does, not on every scroll event.
 */
const RangeContext = createContext<Range | null | undefined>(undefined);

export function useRootContext() {
  const context = useContext(RootContext);
  if (!context) throw new Error('VirtualList parts must be rendered inside <VirtualList.Root>.');
  return context;
}

/** The dataset from `Root`'s `data`. Client only: Server Components can't read context. */
const DataContext = createContext<Dataset<unknown> | null>(null);

export function useDataContext<T>(): Dataset<T> {
  const context = useContext(DataContext);
  if (!context) throw new Error('<VirtualList.Items> needs <VirtualList.Root data={…}>.');
  return context as Dataset<T>;
}

export function useRangeContext() {
  const context = useContext(RangeContext);
  if (context === undefined) throw new Error('VirtualList parts must be rendered inside <VirtualList.Root>.');
  return context;
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
   * The root element's id. In a Server Component it also links the other parts to
   * this `Root`: they pass it as `rootId`, because Server Components can't read
   * context. Unique within the page.
   */
  id?: string;
  /** Total number of items. */
  count: number;
  /** Fixed height of each item, in px. */
  itemSize: number;
  /** Extra items rendered above and below the visible range. */
  overscan?: number;
  /**
   * The page size: ranges passed to `onRangeChange` are whole pages of this size,
   * a server list loading on scroll loads pages of this size, and this many items
   * render before the viewport is measured. Make it at least the number of visible
   * rows. Default 50.
   */
  rangeSize?: number;
  /**
   * Client only: called with the range to load when it changes. The range is
   * snapped so the same rows always give the same range, which makes it a good
   * cache key: it starts at the page (of `rangeSize` items) holding the first
   * visible row and spans enough whole pages to cover the viewport from anywhere
   * in that page (usually two). It only changes when the first visible row moves
   * into another page.
   */
  onRangeChange?: (range: Range) => void;
}

export function Root({
  data,
  offset,
  count,
  itemSize,
  overscan = 5,
  rangeSize = DEFAULT_RANGE_SIZE,
  onRangeChange,
  ...props
}: RootProps) {
  const dataset = useMemo(() => (data === undefined ? null : createDataset(data, { offset })), [data, offset]);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const measured = viewportHeight > 0;
  const start = measured ? Math.max(0, Math.floor(scrollTop / itemSize) - overscan) : 0;
  const end = measured ? Math.min(count, Math.ceil((scrollTop + viewportHeight) / itemSize) + overscan) : 0;
  const range = useMemo(() => (measured ? { start, end } : null), [measured, start, end]);

  // The range to load, snapped to whole pages. It depends only on the page holding
  // the first rendered row (and the viewport's size), so scrolling back to the same
  // rows always reports the same range. `visibleRows` is the most rows `range` can
  // span; one extra page covers a first row anywhere in its page.
  const visibleRows = Math.ceil(viewportHeight / itemSize) + 1 + 2 * overscan;
  const loadStart = Math.floor(start / rangeSize) * rangeSize;
  const loadEnd = Math.min(count, loadStart + (Math.ceil(visibleRows / rangeSize) + 1) * rangeSize);
  const loadRange = useMemo(
    () => (measured ? { start: loadStart, end: loadEnd } : null),
    [measured, loadStart, loadEnd],
  );

  const handleRangeChange = useEffectEvent((next: Range) => onRangeChange?.(next));
  useEffect(() => {
    if (loadRange) handleRangeChange(loadRange);
  }, [loadRange]);

  const root = useMemo(
    () => ({ count, itemSize, rangeSize, setScrollTop, setViewportHeight }),
    [count, itemSize, rangeSize],
  );

  return (
    <RootContext value={root}>
      <RangeContext value={range}>
        <DataContext value={dataset}>
          <div {...props} />
        </DataContext>
      </RangeContext>
    </RootContext>
  );
}
