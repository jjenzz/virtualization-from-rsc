'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from 'react';
import { createDataset, type Dataset, type DatasetInput } from './dataset';
import { Layout } from './layout';
import { Sizes } from './sizes';
import { DEFAULT_RANGE_SIZE, type Range } from './types';

/** Settings and callbacks. Doesn't change on scroll, so `Item` and `Viewport` don't re-render. */
type RootContextValue = {
  /** Total items, across all groups. */
  count: number;
  /** Rows: items, plus a label row per group. */
  layout: Layout;
  /** The fixed item height, or undefined when items are measured. */
  itemSize: number | undefined;
  rangeSize: number;
  /** The viewport scrolled: records the row at the top, works out the rows to render, and re-renders only if they changed. */
  onScroll: (scrollTop: number) => void;
  /** The viewport's height changed. */
  onViewportResize: (height: number) => void;
  /**
   * A row element mounted (variable heights only): measures it and watches it for
   * size changes. `typical` is false for placeholders and group labels, which don't
   * feed the average row height. Returns a function that stops watching.
   */
  onRowMount: (element: Element, row: number, typical: boolean) => () => void;
  /** The scroll container, set by `Viewport`. */
  viewportRef: RefObject<HTMLElement | null>;
  /** The scrollbar was grabbed (true) or released (false). */
  onScrollbarDragChange: (dragging: boolean) => void;
};

const RootContext = createContext<RootContextValue | null>(null);

/**
 * The rendered range, as items and as rows. Until the viewport is measured (server
 * render, hydration) it's the first `rangeSize` rows, so the server and the first
 * client render match. Only changes when the range does, not on every scroll event.
 */
const RangeContext = createContext<{ items: Range; rows: Range } | undefined>(undefined);

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

/** Item heights and positions. Changes when an item is measured. */
const SizesContext = createContext<{ sizes: Sizes; listHeight: number } | null>(null);

export function useSizesContext() {
  const context = useContext(SizesContext);
  if (!context) throw new Error('VirtualList parts must be rendered inside <VirtualList.Root>.');
  return context.sizes;
}

/** The list element's height: the total row height, held still while the scrollbar is dragged. */
export function useListHeight() {
  const context = useContext(SizesContext);
  if (!context) throw new Error('VirtualList parts must be rendered inside <VirtualList.Root>.');
  return context.listHeight;
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
   * every 400 ms, and on release. The range is
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
  defaultItemSize,
  overscan = 5,
  rangeSize = DEFAULT_RANGE_SIZE,
  onRangeChange,
  ...props
}: RootProps) {
  const dataset = useMemo(() => (data === undefined ? null : createDataset(data, { offset })), [data, offset]);
  const countValue = count ?? dataset?.defaultCount;
  if (countValue === undefined) {
    throw new Error('<VirtualList.Root> needs count (or data it can be worked out from, like an items array).');
  }
  const countKey = typeof countValue === 'number' ? countValue : countValue.join(',');
  // `countKey` stands in for the array, which may be a new one on every render.
  const layout = useMemo(() => new Layout(countValue), [countKey]);
  const rowCount = layout.rowCount;
  // The rows to render, worked out from the scroll position in scroll events (see
  // `updateRows`) and kept in state, so scrolling only re-renders when they change.
  // `null` until the viewport is measured. The live position and viewport height
  // are kept in refs for recomputing it when heights or the viewport change.
  const [renderedRows, setRenderedRows] = useState<Range | null>(null);
  const scrollTopRef = useRef(0);
  const viewportHeightRef = useRef(0);
  // Kept as state too, for the range reported to `onRangeChange`. It rarely changes.
  const [viewportHeight, setViewportHeightState] = useState(0);

  const estimate = itemSize ?? defaultItemSize;
  if (estimate === undefined || estimate <= 0) {
    throw new Error('<VirtualList.Root> needs itemSize (fixed heights) or defaultItemSize (measured heights).');
  }
  // Heights are kept in a mutable `Sizes`; `version` re-renders when one changes.
  const [sizesState, setSizes] = useState(() => new Sizes(rowCount, estimate));
  let sizes = sizesState;
  if (sizes.count !== rowCount || sizes.defaultSize !== estimate) {
    sizes = new Sizes(rowCount, estimate, sizes);
    setSizes(sizes);
  }
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  // Read by `measure`, which runs in items' layout effects (before Root's own effects).
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const fixed = itemSize !== undefined;
  const fixedRef = useRef(fixed);
  fixedRef.current = fixed;
  const viewportRef = useRef<HTMLElement | null>(null);

  const draggingRef = useRef(false);
  // Also as state, so grabbing and releasing the scrollbar re-render.
  const [dragging, setDraggingState] = useState(false);
  // The list's total height while the scrollbar is dragged. Measurements still apply
  // (so the rendered rows always cover the viewport), but the total height stays
  // put: a changing height would move the thumb out from under the pointer.
  const [frozenHeight, setFrozenHeight] = useState<number | null>(null);
  const totalHeightRef = useRef(0);

  const overscanRef = useRef(overscan);
  overscanRef.current = overscan;

  /** Works out the rows to render for the current scroll position, and stores them if they changed. */
  const updateRows = useCallback(() => {
    const height = viewportHeightRef.current;
    if (height <= 0) return;
    const current = sizesRef.current;
    const top = scrollTopRef.current;
    const start = Math.max(0, current.indexAt(top) - overscanRef.current);
    const end = Math.min(current.count, current.indexAt(top + height) + 1 + overscanRef.current);
    setRenderedRows((previous) => (previous?.start === start && previous.end === end ? previous : { start, end }));
  }, []);

  // The list's size or the overscan changed: the rows at this position may have too.
  useLayoutEffect(() => updateRows(), [sizes, overscan, updateRows]);

  const handleScroll = useCallback(
    (top: number) => {
      // Record the row at the top first: the next render keeps the view still against
      // it, so it must already reflect this scroll.
      if (!fixedRef.current) anchorRef.current = findAnchor(viewportRef.current);
      scrollTopRef.current = top;
      updateRows();
    },
    [updateRows],
  );

  const handleViewportResize = useCallback(
    (height: number) => {
      viewportHeightRef.current = height;
      setViewportHeightState(height);
      updateRows();
    },
    [updateRows],
  );

  // Called by each row when it renders or resizes.
  const measure = useCallback((row: number, size: number, typical: boolean) => {
    if (fixedRef.current || !sizesRef.current.set(row, size, typical)) return;
    // Heights changed, so the rows at the current position may have too.
    updateRows();
    bump();
  }, []);

  const handleScrollbarDragChange = useCallback((dragging: boolean) => {
    draggingRef.current = dragging;
    setDraggingState(dragging);
    // Released: the height catches up with the measurements, keeping the row at the top where it is.
    if (!dragging) anchorRef.current = findAnchor(viewportRef.current);
    setFrozenHeight(dragging ? totalHeightRef.current : null);
  }, []);

  // One ResizeObserver for all items (cheaper than one per item as rows mount and
  // unmount while scrolling), created on first use.
  const observerRef = useRef<{
    observer: ResizeObserver;
    indices: WeakMap<Element, [row: number, typical: boolean]>;
  } | null>(null);
  const handleRowMount = useCallback(
    (element: Element, row: number, typical: boolean) => {
      // Measured before paint (this runs in the row's layout effect), so a row taller or
      // shorter than the estimate is accounted for without a visible jump; the observer
      // catches later changes, like an image loading.
      measure(row, element.getBoundingClientRect().height, typical);
      if (!observerRef.current) {
        const indices = new WeakMap<Element, [number, boolean]>();
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const watched = indices.get(entry.target);
            if (watched)
              measure(watched[0], entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height, watched[1]);
          }
        });
        observerRef.current = { observer, indices };
      }
      const { observer, indices } = observerRef.current;
      indices.set(element, [row, typical]);
      observer.observe(element);
      return () => observer.unobserve(element);
    },
    [measure],
  );
  useEffect(() => () => observerRef.current?.observer.disconnect(), []);

  // Keeps the view still when rows above it change height (variable heights only),
  // like the browser's own scroll anchoring: the row at the top of the viewport is
  // recorded after each render and on scroll, and if a later render or measurement
  // moved it, the scroll position moves by the same amount.
  const anchorRef = useRef<Anchor | null>(null);
  useLayoutEffect(() => {
    if (fixed) return;
    const viewport = viewportRef.current;
    const anchor = anchorRef.current;
    // Not while the scrollbar is dragged: the thumb follows the pointer, and moving the
    // scroll position would pull it away.
    if (viewport && anchor && !draggingRef.current) {
      const element = viewport.querySelector(`[data-row-index="${anchor.row}"]:not([hidden])`);
      if (element) {
        const moved = element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.top;
        if (Math.abs(moved) >= 0.5) viewport.scrollTop += moved;
      }
    }
    anchorRef.current = findAnchor(viewport);
  });

  const measured = viewportHeight > 0;
  // Until measured (server render, hydration), the first `rangeSize` rows.
  const rows = renderedRows ?? { start: 0, end: rangeSize };
  const rowStart = Math.min(rows.start, rowCount);
  const rowEnd = Math.min(rows.end, rowCount);
  const items = layout.itemsInRows({ start: rowStart, end: rowEnd });
  const start = items.start;
  const end = items.end;
  const range = useMemo(
    () => ({ items: { start, end }, rows: { start: rowStart, end: rowEnd } }),
    [start, end, rowStart, rowEnd],
  );
  const itemCount = layout.itemCount;

  // The range to load, snapped to whole pages. It depends only on the page holding
  // the first rendered row (and the viewport's size), so scrolling back to the same
  // rows always reports the same range. `visibleRows` is the most rows `range` can
  // span; one extra page covers a first row anywhere in its page.
  // With measured heights, rows shorter than the estimate can make the visible range
  // longer than that, so the range is also stretched to cover it.
  const visibleRows = Math.ceil(viewportHeight / estimate) + 1 + 2 * overscan;
  const loadStart = Math.floor(start / rangeSize) * rangeSize;
  const loadEnd = Math.min(
    itemCount,
    Math.max(loadStart + (Math.ceil(visibleRows / rangeSize) + 1) * rangeSize, Math.ceil(end / rangeSize) * rangeSize),
  );
  const loadRange = useMemo(
    () => (measured ? { start: loadStart, end: loadEnd } : null),
    [measured, loadStart, loadEnd],
  );

  const handleRangeChange = useEffectEvent((next: Range) => onRangeChange?.(next));
  // While the scrollbar is dragged, the thumb can cross dozens of ranges a second,
  // and reporting each would start a request for rows gone a moment later. So a
  // range is reported once the thumb has stayed in it for DRAG_SETTLE_MS (a slow
  // drag, or a pause to look), and at least every DRAG_MAX_WAIT_MS during a long
  // drag, so content keeps appearing. Releasing reports the range straight away.
  const lastReportRef = useRef(0);
  useEffect(() => {
    if (!loadRange) return;
    const report = () => {
      lastReportRef.current = performance.now();
      handleRangeChange(loadRange);
    };
    if (!dragging) return report();
    const untilMaxWait = lastReportRef.current + DRAG_MAX_WAIT_MS - performance.now();
    const timer = setTimeout(report, Math.max(0, Math.min(DRAG_SETTLE_MS, untilMaxWait)));
    return () => clearTimeout(timer);
  }, [loadRange, dragging]);

  const root = useMemo(
    () => ({
      count: itemCount,
      layout,
      itemSize,
      rangeSize,
      onScroll: handleScroll,
      onViewportResize: handleViewportResize,
      onRowMount: handleRowMount,
      viewportRef,
      onScrollbarDragChange: handleScrollbarDragChange,
    }),
    [
      itemCount,
      layout,
      itemSize,
      rangeSize,
      handleScroll,
      handleViewportResize,
      handleRowMount,
      handleScrollbarDragChange,
    ],
  );
  // `sizes` is mutated in place, so `version` is what marks a change.
  const totalHeight = sizes.start(rowCount);
  totalHeightRef.current = totalHeight;
  const listHeight = frozenHeight ?? totalHeight;
  const sizesValue = useMemo(() => ({ sizes, listHeight }), [sizes, version, listHeight]);

  return (
    <RootContext value={root}>
      <SizesContext value={sizesValue}>
        <RangeContext value={range}>
          <DataContext value={dataset}>
            <div {...props} />
          </DataContext>
        </RangeContext>
      </SizesContext>
    </RootContext>
  );
}

/** How long the thumb must stay in a range during a drag before it's reported. */
const DRAG_SETTLE_MS = 120;
/** The longest a drag goes without reporting a range. */
const DRAG_MAX_WAIT_MS = 400;

type Anchor = { row: number; top: number };

/** The first row showing in the viewport (item or group label), and its distance from the viewport's top. */
function findAnchor(viewport: HTMLElement | null): Anchor | null {
  if (!viewport) return null;
  const view = viewport.getBoundingClientRect();
  for (const element of viewport.querySelectorAll<HTMLElement>('[data-row-index]:not([hidden])')) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom > view.top && rect.top < view.bottom) {
      return { row: Number(element.dataset.rowIndex), top: rect.top - view.top };
    }
  }
  return null;
}
