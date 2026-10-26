import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefCallback,
  type RefObject,
  type UIEvent,
} from 'react';
import { Layout } from './layout';
import { Sizes } from './sizes';
import { DEFAULT_RANGE_SIZE, indicesOf, type Range } from './types';

/**
 * Headless hooks behind `VirtualList`, public for custom markup (tables, grids).
 * They return refs, props and positions only: no roles or ARIA, which each
 * component adds for its own semantics (a list item's `aria-posinset`, a table
 * row's `aria-rowindex`). `axis: 'x'` virtualizes columns the same way, so a table
 * can use one list for rows and one for columns over a single scroll container.
 */

export type Axis = 'y' | 'x';

/** What differs between the two axes: which scroll position, size and attribute to use. */
const AXES = {
  y: {
    scroll: 'scrollTop',
    client: 'clientHeight',
    start: 'top',
    end: 'bottom',
    size: 'height',
    box: 'blockSize',
    attribute: 'data-row-index',
    dataKey: 'rowIndex',
  },
  x: {
    scroll: 'scrollLeft',
    client: 'clientWidth',
    start: 'left',
    end: 'right',
    size: 'width',
    box: 'inlineSize',
    attribute: 'data-column-index',
    dataKey: 'columnIndex',
  },
} as const;

export interface VirtualizerOptions {
  /** How many items: a number, or one size per group (the total is their sum). */
  count: number | readonly number[];
  /** Size of every item along the axis, in px (controlled). Use this or `defaultItemSize`. */
  itemSize?: number;
  /** Size of items until they're measured, in px (uncontrolled). Use this or `itemSize`. */
  defaultItemSize?: number;
  /** Extra items rendered before and after the visible ones. Default 5. */
  overscan?: number;
  /** Page size of reported ranges, and how many rows render before the viewport is measured. Default 50. */
  rangeSize?: number;
  /** Called with the range to load (snapped to whole pages) when it changes. */
  onRangeChange?: (range: Range) => void;
  /** `'y'` (default) for rows, `'x'` for columns. */
  axis?: Axis;
}

/** The stable part of a list: settings and callbacks. Keeps its identity while scrolling. */
export interface Virtualizer {
  readonly axis: Axis;
  /** The fixed item size, or undefined when items are measured. */
  readonly itemSize: number | undefined;
  readonly rangeSize: number;
  /** The scroll container, set by `useVirtualizerViewport`. */
  readonly viewportRef: RefObject<HTMLElement | null>;
  /** The viewport scrolled to `position` along this list's axis. */
  onScroll(position: number): void;
  /** The viewport's size along this list's axis changed. */
  onViewportResize(size: number): void;
  /** A row element mounted: measures and watches it. `typical` is false for placeholders and labels. */
  onRowMount(element: Element, row: number, typical: boolean): () => void;
  /** The scrollbar was grabbed or released. */
  onScrollbarDragChange(dragging: boolean): void;
}

/** The changing part of a list: what's rendered, and where. */
export interface VirtualizerState {
  readonly axis: Axis;
  /** Total items, across all groups. */
  readonly count: number;
  /** Rows: items, plus a label row per group. */
  readonly layout: Layout;
  readonly sizes: Sizes;
  /** The list's total size, held still while the scrollbar is dragged. */
  readonly listSize: number;
  /** The viewport's size along the axis; 0 until it's measured. */
  readonly viewportSize: number;
  /** The rendered range, as items and as rows. */
  readonly range: { items: Range; rows: Range };
}

export interface UseVirtualizerResult {
  virtualizer: Virtualizer;
  state: VirtualizerState;
}

/** How long the thumb must stay in a range during a drag before it's reported. */
const DRAG_SETTLE_MS = 120;
/** The longest a drag goes without reporting a range. */
const DRAG_MAX_WAIT_MS = 400;

/**
 * The core of a virtual list along one axis: sizes, the rendered range, keeping the
 * view still when rows above it change size, scrollbar drags, and `onRangeChange`.
 * The rendered range is worked out in scroll events and kept in state, so scrolling
 * only re-renders when it changes.
 */
export function useVirtualizer({
  count,
  itemSize,
  defaultItemSize,
  overscan = 5,
  rangeSize = DEFAULT_RANGE_SIZE,
  onRangeChange,
  axis = 'y',
}: VirtualizerOptions): UseVirtualizerResult {
  const countKey = typeof count === 'number' ? count : count.join(',');
  // `countKey` stands in for the array, which may be a new one on every render.
  const layout = useMemo(() => new Layout(count), [countKey]);
  const rowCount = layout.rowCount;

  const estimate = itemSize ?? defaultItemSize;
  if (estimate === undefined || estimate <= 0) {
    throw new Error('A virtual list needs itemSize (fixed sizes) or defaultItemSize (measured sizes).');
  }

  // The rows to render, worked out in scroll events and kept in state. `null` until
  // the viewport is measured. The live position and viewport size are in refs.
  const [renderedRows, setRenderedRows] = useState<Range | null>(null);
  const positionRef = useRef(0);
  const viewportSizeRef = useRef(0);
  // Kept as state too, for the range reported to `onRangeChange`. It rarely changes.
  const [viewportSize, setViewportSize] = useState(0);

  // Sizes are kept in a mutable `Sizes`; `version` re-renders when one changes.
  const [sizesState, setSizes] = useState(() => new Sizes(rowCount, estimate));
  let sizes = sizesState;
  if (sizes.count !== rowCount || sizes.defaultSize !== estimate) {
    sizes = new Sizes(rowCount, estimate, sizes);
    setSizes(sizes);
  }
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  // Read by callbacks that run between renders.
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const fixed = itemSize !== undefined;
  const fixedRef = useRef(fixed);
  fixedRef.current = fixed;
  const overscanRef = useRef(overscan);
  overscanRef.current = overscan;
  const axisRef = useRef(axis);
  axisRef.current = axis;
  const viewportRef = useRef<HTMLElement | null>(null);
  const anchorRef = useRef<Anchor | null>(null);

  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  // The total size while the scrollbar is dragged. Measurements still apply (so the
  // rendered rows always cover the viewport), but the total stays put: a changing
  // total would move the thumb out from under the pointer.
  const [frozenSize, setFrozenSize] = useState<number | null>(null);
  const totalSizeRef = useRef(0);

  /** Works out the rows to render for the current position, and stores them if they changed. */
  const updateRows = useCallback(() => {
    const size = viewportSizeRef.current;
    if (size <= 0) return;
    const current = sizesRef.current;
    const position = positionRef.current;
    const start = Math.max(0, current.indexAt(position) - overscanRef.current);
    const end = Math.min(current.count, current.indexAt(position + size) + 1 + overscanRef.current);
    setRenderedRows((previous) => (previous?.start === start && previous.end === end ? previous : { start, end }));
  }, []);

  // The list's size or the overscan changed: the rows at this position may have too.
  useLayoutEffect(() => updateRows(), [sizes, overscan, updateRows]);

  const onScroll = useCallback(
    (position: number) => {
      // Record the row at the start first: the next render keeps the view still
      // against it, so it must already reflect this scroll.
      if (!fixedRef.current) anchorRef.current = findAnchor(viewportRef.current, axisRef.current);
      positionRef.current = position;
      updateRows();
    },
    [updateRows],
  );

  const onViewportResize = useCallback(
    (size: number) => {
      viewportSizeRef.current = size;
      setViewportSize(size);
      updateRows();
    },
    [updateRows],
  );

  const measure = useCallback(
    (row: number, size: number, typical: boolean) => {
      if (fixedRef.current || !sizesRef.current.set(row, size, typical)) return;
      // Sizes changed, so the rows at the current position may have too.
      updateRows();
      bump();
    },
    [updateRows],
  );

  const onScrollbarDragChange = useCallback((isDragging: boolean) => {
    draggingRef.current = isDragging;
    setDragging(isDragging);
    // Released: the total catches up with the measurements, keeping the row at the start where it is.
    if (!isDragging) anchorRef.current = findAnchor(viewportRef.current, axisRef.current);
    setFrozenSize(isDragging ? totalSizeRef.current : null);
  }, []);

  // One ResizeObserver for all rows (cheaper than one per row as rows mount and
  // unmount while scrolling), created on first use.
  const observerRef = useRef<{ observer: ResizeObserver; rows: WeakMap<Element, [number, boolean]> } | null>(null);
  const onRowMount = useCallback(
    (element: Element, row: number, typical: boolean) => {
      const { size } = AXES[axisRef.current];
      // Measured before paint (row refs run during the commit), so a row larger or
      // smaller than the estimate is accounted for without a visible jump; the
      // observer catches later changes, like an image loading.
      measure(row, element.getBoundingClientRect()[size], typical);
      if (!observerRef.current) {
        const rows = new WeakMap<Element, [number, boolean]>();
        const observer = new ResizeObserver((entries) => {
          const { size: rectSize, box: boxSize } = AXES[axisRef.current];
          for (const entry of entries) {
            const watched = rows.get(entry.target);
            if (watched)
              measure(watched[0], entry.borderBoxSize?.[0]?.[boxSize] ?? entry.contentRect[rectSize], watched[1]);
          }
        });
        observerRef.current = { observer, rows };
      }
      const { observer, rows } = observerRef.current;
      rows.set(element, [row, typical]);
      observer.observe(element);
      return () => observer.unobserve(element);
    },
    [measure],
  );
  useEffect(() => () => observerRef.current?.observer.disconnect(), []);

  // Keeps the view still when rows before it change size (measured sizes only),
  // like the browser's own scroll anchoring: the row at the start of the viewport is
  // recorded after each render and on scroll, and if a later render or measurement
  // moved it, the scroll position moves by the same amount. Not during a scrollbar
  // drag: the thumb follows the pointer, and moving the position would pull it away.
  useLayoutEffect(() => {
    if (fixed) return;
    const viewport = viewportRef.current;
    const anchor = anchorRef.current;
    const { attribute, start, scroll } = AXES[axis];
    if (viewport && anchor && !draggingRef.current) {
      const element = viewport.querySelector(`[${attribute}="${anchor.row}"]:not([hidden])`);
      if (element) {
        const moved =
          element.getBoundingClientRect()[start] -
          windowShift(element, axis) -
          viewport.getBoundingClientRect()[start] -
          anchor.offset;
        if (Math.abs(moved) >= 0.5) viewport[scroll] += moved;
      }
    }
    anchorRef.current = findAnchor(viewport, axis);
  });

  const measured = viewportSize > 0;
  // Until measured (server render, hydration), the first `rangeSize` rows.
  const rows = renderedRows ?? { start: 0, end: rangeSize };
  const rowStart = Math.min(rows.start, rowCount);
  const rowEnd = Math.min(rows.end, rowCount);
  const items = layout.itemsInRows({ start: rowStart, end: rowEnd });
  const range = useMemo(
    () => ({ items: { start: items.start, end: items.end }, rows: { start: rowStart, end: rowEnd } }),
    [items.start, items.end, rowStart, rowEnd],
  );
  const itemCount = layout.itemCount;

  // The range to load, snapped to whole pages. It depends only on the page holding
  // the first rendered row (and the viewport's size), so scrolling back to the same
  // rows always reports the same range; it's stretched to cover the rendered items
  // when they're smaller than the estimate.
  const visibleRows = Math.ceil(viewportSize / estimate) + 1 + 2 * overscan;
  const loadStart = Math.floor(items.start / rangeSize) * rangeSize;
  const loadEnd = Math.min(
    itemCount,
    Math.max(
      loadStart + (Math.ceil(visibleRows / rangeSize) + 1) * rangeSize,
      Math.ceil(items.end / rangeSize) * rangeSize,
    ),
  );
  const loadRange = useMemo(
    () => (measured ? { start: loadStart, end: loadEnd } : null),
    [measured, loadStart, loadEnd],
  );

  const reportRange = useEffectEvent((next: Range) => onRangeChange?.(next));
  // During a scrollbar drag the thumb can cross dozens of ranges a second, so a
  // range is reported once the thumb settles in it, at least every DRAG_MAX_WAIT_MS,
  // and straight away on release.
  const lastReportRef = useRef(0);
  useEffect(() => {
    if (!loadRange) return;
    const report = () => {
      lastReportRef.current = performance.now();
      reportRange(loadRange);
    };
    if (!dragging) return report();
    const untilMaxWait = lastReportRef.current + DRAG_MAX_WAIT_MS - performance.now();
    const timer = setTimeout(report, Math.max(0, Math.min(DRAG_SETTLE_MS, untilMaxWait)));
    return () => clearTimeout(timer);
  }, [loadRange, dragging]);

  const virtualizer = useMemo<Virtualizer>(
    () => ({ axis, itemSize, rangeSize, viewportRef, onScroll, onViewportResize, onRowMount, onScrollbarDragChange }),
    [axis, itemSize, rangeSize, onScroll, onViewportResize, onRowMount, onScrollbarDragChange],
  );

  const totalSize = sizes.start(rowCount);
  totalSizeRef.current = totalSize;
  const listSize = frozenSize ?? totalSize;
  // `sizes` is mutated in place, so `version` is what marks a change.
  const state = useMemo<VirtualizerState>(
    () => ({ axis, count: itemCount, layout, sizes, listSize, viewportSize, range }),
    [axis, itemCount, layout, sizes, version, listSize, viewportSize, range],
  );

  return { virtualizer, state };
}

type Anchor = { row: number; offset: number };

/**
 * The first row in the viewport (item or group label), and its distance from the
 * viewport's start. Positions are where rows belong, not where a sticky window
 * holding them at the viewport's edge has them, so a scroll that outran the
 * rendered rows doesn't look like rows moving.
 */
function findAnchor(viewport: HTMLElement | null, axis: Axis): Anchor | null {
  if (!viewport) return null;
  const { attribute, dataKey, start, end } = AXES[axis];
  const view = viewport.getBoundingClientRect();
  let shift: number | undefined;
  for (const element of viewport.querySelectorAll<HTMLElement>(`[${attribute}]:not([hidden])`)) {
    // All rendered rows share one window, so its shift is read once.
    shift ??= windowShift(element, axis);
    const rect = element.getBoundingClientRect();
    if (rect[end] - shift > view[start] && rect[start] - shift < view[end]) {
      return { row: Number(element.dataset[dataKey]), offset: rect[start] - shift - view[start] };
    }
  }
  return null;
}

const WINDOW_ATTRIBUTE = 'data-virtualizer-window';

/** The attribute marking a rendered row's index, by axis. */
type RowAttribute = { 'data-row-index'?: number; 'data-column-index'?: number };

/**
 * How far the sticky window holding `element` is pushed from where its rows belong:
 * the gap between the window and the spacer just before it. 0 when it isn't held.
 */
function windowShift(element: Element, axis: Axis): number {
  const holder = element.closest(`[${WINDOW_ATTRIBUTE}="${axis}"]`);
  const spacer = holder?.previousElementSibling;
  if (!holder || !spacer) return 0;
  const { start, end } = AXES[axis];
  return holder.getBoundingClientRect()[start] - spacer.getBoundingClientRect()[end];
}

/**
 * The scroll container for one list, or several sharing it (a table's rows and
 * columns). Spread `props` on the element and attach `ref`. Grabbing its scrollbar
 * is detected here: a press on the container itself, not on its content.
 */
export function useVirtualizerViewport(input: Virtualizer | readonly Virtualizer[]) {
  const virtualizers: readonly Virtualizer[] = 'axis' in input ? [input] : input;
  const virtualizersRef = useRef(virtualizers);
  virtualizersRef.current = virtualizers;

  const ref = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      if (!element) return;
      const current = virtualizersRef.current;
      for (const virtualizer of current) virtualizer.viewportRef.current = element;
      const resize = () => {
        for (const virtualizer of current) virtualizer.onViewportResize(element[AXES[virtualizer.axis].client]);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      // The user may have scrolled before hydration, and React doesn't replay that scroll event.
      for (const virtualizer of current) virtualizer.onScroll(element[AXES[virtualizer.axis].scroll]);
      return () => {
        observer.disconnect();
        for (const virtualizer of current)
          if (virtualizer.viewportRef.current === element) virtualizer.viewportRef.current = null;
      };
    },
    // A new callback (re-attaching) only when the virtualizers themselves change.
    virtualizers,
  );

  const props = {
    // The list keeps the view still itself when measured rows change size before it;
    // the browser's own scroll anchoring would fight that.
    style: { overflow: 'auto', overflowAnchor: 'none' } satisfies CSSProperties,
    onScroll: (event: UIEvent<HTMLElement>) => {
      for (const virtualizer of virtualizersRef.current)
        virtualizer.onScroll(event.currentTarget[AXES[virtualizer.axis].scroll]);
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      const current = virtualizersRef.current;
      for (const virtualizer of current) virtualizer.onScrollbarDragChange(true);
      const release = () => {
        for (const virtualizer of current) virtualizer.onScrollbarDragChange(false);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    },
  };
  return { ref, props };
}

/** A group with rows in the rendered range. */
export interface VirtualizerGroupRange {
  index: number;
  /** The group's rendered items. */
  items: Range;
  /** The row of the group's label. */
  labelRow: number;
  /** Whether the label's row is rendered; otherwise keep it mounted but hidden, for `aria-labelledby`. */
  labelInRange: boolean;
}

/**
 * What to render, in this order inside the list element (`listStyle`): the spacer
 * (`spacerStyle`), then the window (`windowProps`) holding the rendered rows, plus
 * the rendered item indexes and (in a grouped list) the groups with rendered rows.
 *
 * The window is sticky, with insets that let it move only once a scroll outruns
 * it: a fast trackpad or wheel scroll moves the content before the next rows can
 * render, and instead of leaving blank space the window stays at the viewport's
 * edge, showing the rows it has until the new ones arrive. Its insets are
 * `viewport size - window size` (negative), so it never stops covering the viewport.
 */
export function useVirtualizerItems(state: VirtualizerState) {
  return useMemo(() => {
    const { axis, layout, sizes, listSize, viewportSize, range } = state;
    const { size, start, end } = AXES[axis];
    const windowSize = sizes.start(range.rows.end) - sizes.start(range.rows.start);
    // Not held anywhere until the viewport is measured (server render, hydration).
    const inset = viewportSize > 0 ? Math.min(0, viewportSize - windowSize) : undefined;
    const groups: VirtualizerGroupRange[] = indicesOf(layout.groupsInRows(range.rows)).map((index) => {
      const labelRow = layout.labelRow(index);
      return {
        index,
        items: intersect(layout.groupItems(index), range.items),
        labelRow,
        labelInRange: labelRow >= range.rows.start && labelRow < range.rows.end,
      };
    });
    return {
      /** Style for the element holding every row: its full size. */
      listStyle: { [size]: listSize } as CSSProperties,
      /** Style for the spacer before the rendered rows: the size of everything before them. */
      spacerStyle: { [size]: sizes.start(range.rows.start) } as CSSProperties,
      /** Props for the element holding the rendered rows, straight after the spacer. */
      windowProps: {
        [WINDOW_ATTRIBUTE]: axis,
        style: { position: 'sticky', [start]: inset, [end]: inset } as CSSProperties,
      },
      /** The rendered item indexes (counting items only, across all groups). */
      indexes: indicesOf(range.items),
      /** The groups with rendered rows; empty for a flat list. */
      groups,
      /** The row an item is on (equal to its index in a flat list). */
      rowOf: (index: number) => layout.rowOfItem(index),
    };
  }, [state]);
}

function intersect(a: Range, b: Range): Range {
  const start = Math.max(a.start, b.start);
  return { start, end: Math.max(start, Math.min(a.end, b.end)) };
}

/**
 * One rendered item: attach `ref` and spread `props` on its element. `row` is its
 * row (from `rowOf`), and `pending` marks a placeholder, measured for layout but
 * kept out of the average item size. Adds no roles or ARIA: map the index to
 * `aria-posinset`, `aria-rowindex` or whatever the markup needs.
 */
export function useVirtualizerItem(
  virtualizer: Virtualizer,
  { index, row, pending = false }: { index: number; row: number; pending?: boolean },
) {
  const { axis, itemSize, onRowMount } = virtualizer;
  const ref = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      if (!element || itemSize !== undefined) return;
      return onRowMount(element, row, !pending);
    },
    [itemSize, row, pending, onRowMount],
  );
  const { attribute, size } = AXES[axis];
  const props = {
    ...(axis === 'y' ? { 'data-index': index } : null),
    ...({ [attribute]: row } as RowAttribute),
    style: itemSize === undefined ? undefined : ({ [size]: itemSize } as CSSProperties),
  };
  return { ref, props };
}

/**
 * One rendered group's label: attach `labelRef` and spread `labelProps` on it, and
 * point the group's wrapper at `labelId` (e.g. `aria-labelledby`). The label is a
 * row of its own, measured but kept out of the average item size, and hidden while
 * its row is outside the rendered range.
 */
export function useVirtualizerGroup(virtualizer: Virtualizer, group: VirtualizerGroupRange) {
  const { axis, itemSize, onRowMount } = virtualizer;
  const labelId = useId();
  const { labelRow, labelInRange } = group;
  const labelRef = useCallback<RefCallback<HTMLElement>>(
    (element) => {
      if (!element || itemSize !== undefined || !labelInRange) return;
      return onRowMount(element, labelRow, false);
    },
    [itemSize, labelRow, labelInRange, onRowMount],
  );
  const { attribute, size } = AXES[axis];
  const labelProps = {
    id: labelId,
    ...({ [attribute]: labelRow } as RowAttribute),
    hidden: !labelInRange,
    'aria-hidden': 'true' as const,
    // `hidden` alone loses to a class that sets `display`, so it's enforced inline.
    style: {
      ...(itemSize === undefined ? null : { [size]: itemSize }),
      ...(labelInRange ? null : { display: 'none' }),
    } as CSSProperties,
  };
  return { labelId, labelRef, labelProps };
}
