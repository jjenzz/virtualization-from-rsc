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
 * Next runs server functions one at a time, so pages are queued here and a page
 * that scrolled out of view before its turn is skipped (it's queued again if it
 * comes back into view).
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
  const loader = useRef({
    requested: new Set<number>(pagesIn({ start: 0, end: first.length }, rangeSize)),
    failed: new Set<number>(),
    queue: [] as number[],
    running: false,
    visible: null as Range | null,
  });

  useEffect(() => {
    if (!range) return;
    const state = loader.current;
    state.visible = range;
    let retrying = false;
    for (const page of pagesIn(range, rangeSize)) {
      if (state.requested.has(page)) continue;
      state.requested.add(page);
      state.queue.push(page);
      // A failed page shows the placeholder again while it's retried.
      retrying = state.failed.delete(page) || retrying;
    }
    if (retrying) rerender();
    if (state.running) return;

    // Calls run from this effect, never during render: calling a server function
    // updates Next's router state, which isn't allowed while another component renders.
    state.running = true;
    void (async () => {
      while (state.queue.length > 0) {
        const page = state.queue.shift()!;
        const start = page * rangeSize;
        const end = Math.min(count, start + rangeSize);
        if (!state.visible || end <= state.visible.start || start >= state.visible.end) {
          state.requested.delete(page);
          continue;
        }
        try {
          const loaded = await loadRange({ start, end });
          for (let i = 0; i < loaded.length; i++) rows.current[start + i] = loaded[i];
          rerender();
        } catch (error) {
          // Request failed (e.g. offline): show the error row, and forget the page so
          // it's requested again when it next comes into view.
          console.error(`<VirtualList.Items> couldn't load items ${start}-${end - 1}.`, error);
          state.requested.delete(page);
          state.failed.add(page);
          rerender();
        }
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
