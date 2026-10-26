'use client';

import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { Items } from './items';

/** A run of rendered rows and the index of the first one. */
export type Slice = { start: number; rows: ReactNode[] };

/**
 * Client half of the server build. Starts with the first chunk of rows; each page
 * promise resolves to slice promises, and each slice's rows are written at their
 * own indices, so arrival order doesn't matter. If the stream fails (a promise
 * rejects, e.g. the connection dropped), rows that never arrived show `errorRow`.
 * Rows are kept in a ref and
 * re-rendered rather than read with use() + Suspense, which would hold them back
 * by React's ~300 ms reveal throttle.
 */
export function ItemsStream({
  start,
  first,
  placeholder,
  errorRow,
  pages,
}: {
  /** The index of `first[0]`: 0, or a group's first item. */
  start: number;
  first: ReactNode[];
  /** `children(undefined, -1, 'pending')`, shown for rows whose slice hasn't arrived. */
  placeholder: ReactNode;
  /** `children(undefined, -1, 'error')`, shown for rows that never arrived because the stream failed. */
  errorRow: ReactNode;
  pages: Promise<Promise<Slice>[]>[];
}) {
  const rows = useRef<ReactNode[] | null>(null);
  if (!rows.current) {
    rows.current = [];
    first.forEach((row, i) => (rows.current![start + i] = row));
  }
  const failed = useRef(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let active = true;
    const fail = (error: unknown) => {
      if (!active || failed.current) return;
      console.error('<VirtualList.Items> the stream failed; rows that never arrived show the error row.', error);
      failed.current = true;
      rerender();
    };
    for (const page of pages) {
      page.then((slices) => {
        for (const slice of slices) {
          slice.then(({ start, rows: sliceRows }) => {
            if (!active) return;
            for (let i = 0; i < sliceRows.length; i++) rows.current![start + i] = sliceRows[i];
            rerender();
          }, fail);
        }
      }, fail);
    }
    return () => {
      active = false;
    };
  }, [pages]);

  return (
    <Items isPending={(index) => !(index in rows.current!)}>
      {(index) =>
        // `in`, not `??`: a row that arrived may be null (children rendered nothing).
        index in rows.current! ? rows.current![index] : failed.current ? errorRow : placeholder
      }
    </Items>
  );
}
