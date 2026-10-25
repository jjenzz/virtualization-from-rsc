'use client';

import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { Items } from './items';
import { useRangeContext, useRootContext } from './root';
import type { Range } from './types';

type LoadRange = (range: Range) => Promise<ReactNode[]>;

/**
 * Client half of the server build's load-on-scroll mode. Starts with the first
 * page of rows from the server; as the visible range changes, it asks the server
 * for each missing page (one call per page, `rangeSize` rows) and writes the
 * rows at their indices. Rows not loaded yet show `placeholder`. If a page's
 * request fails (e.g. offline), its rows show `errorRow` until the page comes
 * back into view, when it's requested again.
 *
 * Next runs server functions one at a time, so the next page is picked only when
 * the previous request finishes, from what's on screen then: visible pages first,
 * nearest the middle of the viewport first, then one page ahead in the scroll
 * direction. Pages scrolled past are never requested, and the page you stop on
 * waits for at most the request already in flight.
 */
export function ItemsLoader({
  first,
  placeholder,
  errorRow,
  loadRange,
}: {
  first: ReactNode[];
  placeholder: ReactNode;
  errorRow: ReactNode;
  loadRange: LoadRange;
}) {
  const { count, rangeSize } = useRootContext();
  const range = useRangeContext();
  const rows = useRef<ReactNode[]>([...first]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const loader = useRef<LoaderState>({
    loaded: new Set(pagesIn({ start: 0, end: first.length }, rangeSize)),
    failed: new Set(),
    inFlight: null,
    running: false,
    visible: null,
    direction: 1,
  });

  useEffect(() => {
    if (!range) return;
    const state = loader.current;
    if (state.visible && range.start !== state.visible.start)
      state.direction = range.start > state.visible.start ? 1 : -1;
    state.visible = range;
    // Failed pages back in view are tried again (showing the placeholder meanwhile).
    let retrying = false;
    for (const page of pagesIn(range, rangeSize)) retrying = state.failed.delete(page) || retrying;
    if (retrying) rerender();
    if (state.running) return;

    // Calls run from this effect, never during render: calling a server function
    // updates Next's router state, which isn't allowed while another component renders.
    state.running = true;
    void (async () => {
      for (let page = nextPage(state, rangeSize, count); page !== null; page = nextPage(state, rangeSize, count)) {
        const start = page * rangeSize;
        const end = Math.min(count, start + rangeSize);
        state.inFlight = page;
        try {
          const loaded = await loadRange({ start, end });
          for (let i = 0; i < loaded.length; i++) rows.current[start + i] = loaded[i];
          state.loaded.add(page);
        } catch (error) {
          // Request failed (e.g. offline): show the error row until the page comes
          // back into view, when it's tried again.
          console.error(`<VirtualList.Items> couldn't load items ${start}-${end - 1}.`, error);
          state.failed.add(page);
        } finally {
          state.inFlight = null;
        }
        rerender();
      }
      state.running = false;
    })();
  }, [range, rangeSize, count, loadRange]);

  return (
    <Items initialCount={first.length}>
      {(index) =>
        // `in`, not `??`: a row that arrived may be null (children rendered nothing).
        index in rows.current
          ? rows.current[index]
          : loader.current.failed.has(Math.floor(index / rangeSize))
            ? errorRow
            : placeholder
      }
    </Items>
  );
}

function pagesIn({ start, end }: Range, rangeSize: number): number[] {
  if (end <= start) return [];
  const pages: number[] = [];
  for (let p = Math.floor(start / rangeSize); p <= Math.floor((end - 1) / rangeSize); p++) pages.push(p);
  return pages;
}

type LoaderState = {
  /** Pages whose rows have arrived. */
  loaded: Set<number>;
  /** Pages whose request failed; not requested again until they're back in view. */
  failed: Set<number>;
  /** The page being requested now. */
  inFlight: number | null;
  running: boolean;
  /** The visible range, as of the last render. */
  visible: Range | null;
  /** 1 when scrolling down, -1 when scrolling up. */
  direction: 1 | -1;
};

/**
 * The page to request next, decided when the previous request finishes: a visible
 * page that's still missing, nearest the middle of the viewport first, or else the
 * page just past the visible ones in the scroll direction. `null` when there's
 * nothing left to load for now.
 */
function nextPage(state: LoaderState, rangeSize: number, count: number): number | null {
  const { visible } = state;
  if (!visible) return null;
  const missing = (page: number) =>
    page >= 0 &&
    page * rangeSize < count &&
    !state.loaded.has(page) &&
    !state.failed.has(page) &&
    page !== state.inFlight;
  const pages = pagesIn(visible, rangeSize);
  const middle = (visible.start + visible.end) / 2;
  const distance = (page: number) => Math.abs((page + 0.5) * rangeSize - middle);
  const visibleMissing = pages.filter(missing).sort((a, b) => distance(a) - distance(b));
  if (visibleMissing.length > 0) return visibleMissing[0];
  if (pages.length === 0) return null;
  const ahead = state.direction > 0 ? pages[pages.length - 1] + 1 : pages[0] - 1;
  return missing(ahead) ? ahead : null;
}
