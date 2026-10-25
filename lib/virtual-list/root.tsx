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
import { Sizes } from './sizes';
import { DEFAULT_RANGE_SIZE, type Range } from './types';

/** Settings and setters. Doesn't change on scroll, so `Item` and `Viewport` don't re-render. */
type RootContextValue = {
  count: number;
  /** The fixed item height, or undefined when items are measured. */
  itemSize: number | undefined;
  rangeSize: number;
  setScrollTop: (value: number) => void;
  setViewportHeight: (value: number) => void;
  /** Records an item's measured height (variable heights only). */
  measure: (index: number, size: number) => void;
  /** Watches an item element for size changes; returns a function that stops. */
  observe: (element: Element, index: number) => () => void;
  /** The scroll container, set by `Viewport`. */
  viewportRef: RefObject<HTMLElement | null>;
  /** Records which row is at the top of the viewport (variable heights only). */
  captureAnchor: () => void;
  /** Called when the scrollbar is grabbed (true) and released (false). */
  setDragging: (dragging: boolean) => void;
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

/** Item heights and positions. Changes when an item is measured. */
const SizesContext = createContext<{ sizes: Sizes } | null>(null);

export function useSizesContext() {
  const context = useContext(SizesContext);
  if (!context) throw new Error('VirtualList parts must be rendered inside <VirtualList.Root>.');
  return context.sizes;
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
  defaultItemSize,
  overscan = 5,
  rangeSize = DEFAULT_RANGE_SIZE,
  onRangeChange,
  ...props
}: RootProps) {
  const dataset = useMemo(() => (data === undefined ? null : createDataset(data, { offset })), [data, offset]);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const estimate = itemSize ?? defaultItemSize;
  if (estimate === undefined || estimate <= 0) {
    throw new Error('<VirtualList.Root> needs itemSize (fixed heights) or defaultItemSize (measured heights).');
  }
  // Heights are kept in a mutable `Sizes`; `version` re-renders when one changes.
  const [sizesState, setSizes] = useState(() => new Sizes(count, estimate));
  let sizes = sizesState;
  if (sizes.count !== count || sizes.defaultSize !== estimate) {
    sizes = new Sizes(count, estimate, sizes);
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
  const pendingRef = useRef(new Map<number, number>());

  // Called by each item when it renders or resizes.
  const measure = useCallback((index: number, size: number) => {
    if (fixedRef.current) return;
    // While the scrollbar is dragged, measurements wait: applying them would change
    // the total height under the pointer and make the thumb drift from it.
    if (draggingRef.current) pendingRef.current.set(index, size);
    else if (sizesRef.current.set(index, size)) bump();
  }, []);

  const setDragging = useCallback((dragging: boolean) => {
    draggingRef.current = dragging;
    if (dragging || pendingRef.current.size === 0) return;
    // Released: apply what was measured, keeping the row at the top where it is.
    anchorRef.current = findAnchor(viewportRef.current);
    let changed = false;
    pendingRef.current.forEach((size, index) => {
      changed = sizesRef.current.set(index, size) || changed;
    });
    pendingRef.current.clear();
    if (changed) bump();
  }, []);

  // One ResizeObserver for all items (cheaper than one per item as rows mount and
  // unmount while scrolling), created on first use.
  const observerRef = useRef<{ observer: ResizeObserver; indices: WeakMap<Element, number> } | null>(null);
  const observe = useCallback(
    (element: Element, index: number) => {
      if (!observerRef.current) {
        const indices = new WeakMap<Element, number>();
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const i = indices.get(entry.target);
            if (i !== undefined) measure(i, entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
          }
        });
        observerRef.current = { observer, indices };
      }
      const { observer, indices } = observerRef.current;
      indices.set(element, index);
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
  const captureAnchor = useCallback(() => {
    if (!fixedRef.current) anchorRef.current = findAnchor(viewportRef.current);
  }, []);
  useLayoutEffect(() => {
    if (fixed) return;
    const viewport = viewportRef.current;
    const anchor = anchorRef.current;
    // Not while the scrollbar is dragged: the thumb follows the pointer, and moving the
    // scroll position would pull it away.
    if (viewport && anchor && !draggingRef.current) {
      const element = viewport.querySelector(`[data-index="${anchor.index}"]`);
      if (element) {
        const moved = element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.top;
        if (Math.abs(moved) >= 0.5) viewport.scrollTop += moved;
      }
    }
    anchorRef.current = findAnchor(viewport);
  });

  const measured = viewportHeight > 0;
  const start = measured ? Math.max(0, sizes.indexAt(scrollTop) - overscan) : 0;
  const end = measured ? Math.min(count, sizes.indexAt(scrollTop + viewportHeight) + 1 + overscan) : 0;
  const range = useMemo(() => (measured ? { start, end } : null), [measured, start, end]);

  // The range to load, snapped to whole pages. It depends only on the page holding
  // the first rendered row (and the viewport's size), so scrolling back to the same
  // rows always reports the same range. `visibleRows` is the most rows `range` can
  // span; one extra page covers a first row anywhere in its page.
  // With measured heights, rows shorter than the estimate can make the visible range
  // longer than that, so the range is also stretched to cover it.
  const visibleRows = Math.ceil(viewportHeight / estimate) + 1 + 2 * overscan;
  const loadStart = Math.floor(start / rangeSize) * rangeSize;
  const loadEnd = Math.min(
    count,
    Math.max(loadStart + (Math.ceil(visibleRows / rangeSize) + 1) * rangeSize, Math.ceil(end / rangeSize) * rangeSize),
  );
  const loadRange = useMemo(
    () => (measured ? { start: loadStart, end: loadEnd } : null),
    [measured, loadStart, loadEnd],
  );

  const handleRangeChange = useEffectEvent((next: Range) => onRangeChange?.(next));
  useEffect(() => {
    if (loadRange) handleRangeChange(loadRange);
  }, [loadRange]);

  const root = useMemo(
    () => ({
      count,
      itemSize,
      rangeSize,
      setScrollTop,
      setViewportHeight,
      measure,
      observe,
      viewportRef,
      captureAnchor,
      setDragging,
    }),
    [count, itemSize, rangeSize, measure, observe, captureAnchor, setDragging],
  );
  // `sizes` is mutated in place, so `version` is what marks a change.
  const sizesValue = useMemo(() => ({ sizes }), [sizes, version]);

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

type Anchor = { index: number; top: number };

/** The first row showing in the viewport, and its distance from the viewport's top. */
function findAnchor(viewport: HTMLElement | null): Anchor | null {
  if (!viewport) return null;
  const view = viewport.getBoundingClientRect();
  for (const element of viewport.querySelectorAll<HTMLElement>('[role="listitem"][data-index]')) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom > view.top && rect.top < view.bottom) {
      return { index: Number(element.dataset.index), top: rect.top - view.top };
    }
  }
  return null;
}
