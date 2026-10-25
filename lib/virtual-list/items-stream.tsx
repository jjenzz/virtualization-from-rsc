'use client';

import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { Items } from './items';

/**
 * Client half of the server build. Starts with the first range of rows and
 * appends each chunk as its promise resolves. The server resolves them in order,
 * each with one row per index (errored rows included), so positions line up.
 * Rows are kept in a ref and re-rendered rather than read with use() + Suspense,
 * which would hold them back by React's ~300 ms reveal throttle.
 */
export function ItemsStream({
  count,
  first,
  chunks,
}: {
  count: number;
  first: ReactNode[];
  chunks: Promise<ReactNode[]>[];
}) {
  const rows = useRef<ReactNode[]>([...first]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let active = true;
    for (const chunk of chunks) {
      void chunk.then((chunkRows) => {
        if (!active) return;
        rows.current.push(...chunkRows);
        rerender();
      });
    }
    return () => {
      active = false;
    };
  }, [chunks]);

  return (
    <Items count={count} initialCount={first.length}>
      {(index) => rows.current[index] ?? null}
    </Items>
  );
}
