import { createElement, Fragment, type ReactNode } from 'react';
import { indicesOf, type ItemStatus, type Range, type RenderItem } from './types';

/**
 * Fetching and rendering for the server build's stream:
 * - `getItems` throws: the range's rows render with status "error" and their index.
 * - `getItems` returns no item for an index: that row renders with status "missing".
 * - `children` throws for a row: that row renders nothing and the error is logged.
 */

export type Fetched<T> = { ok: true; data: (T | undefined)[] } | { ok: false };

type Load<T> = (range: Range) => Promise<(T | undefined)[]> | (T | undefined)[];

/** Fetches a range. A failure is returned rather than thrown, so its rows can render as errors. */
export async function fetchRows<T>(load: Load<T>, range: Range): Promise<Fetched<T>> {
  try {
    return { ok: true, data: await load(range) };
  } catch (error) {
    console.error(`<VirtualList.Items> getItems failed for items ${range.start}-${range.end - 1}.`, error);
    return { ok: false };
  }
}

/**
 * Renders `range` from what `fetchRows` returned. `offset` is the index where
 * `fetched.data` starts, so part of a fetched page can be rendered. Stays
 * synchronous unless `children` is async.
 */
export function renderRows<T>(
  render: RenderItem<T>,
  range: Range,
  fetched: Fetched<T>,
  offset: number,
): ReactNode[] | Promise<ReactNode[]> {
  const errors: unknown[] = [];
  const rows = indicesOf(range).map((index) => {
    if (!fetched.ok) return guard(() => render(undefined, index, 'error'), errors);
    const item = fetched.data[index - offset];
    return guard(
      () => (item === undefined ? render(undefined, index, 'missing') : render(item, index, 'loaded')),
      errors,
    );
  });
  const report = (settled: ReactNode[]) => {
    // The server collects rows into arrays (the first chunk, slices, pages) that
    // are sent to the client as props, and React warns about elements without a
    // key in an array. Wrapping each row in a Fragment keyed by index removes the
    // warning, so the server `children` doesn't need to set a key. The key isn't
    // used otherwise: each row renders alone in a slot keyed by index.
    const keyed = settled.map((row, i) => createElement(Fragment, { key: range.start + i }, row));
    if (errors.length > 0) {
      console.error(
        `<VirtualList.Items> children threw for ${errors.length} of items ${range.start}-${range.end - 1}; ` +
          'those rows render nothing.',
        errors[0],
      );
    }
    return keyed;
  };
  return rows.some(isPromise) ? Promise.all(rows).then(report) : report(rows as ReactNode[]);
}

/**
 * Renders the row shown for every index not loaded yet ("pending") or whose
 * stream or request failed ("error"). Called once, with index -1.
 */
export async function renderTemplate<T>(render: RenderItem<T>, status: Extract<ItemStatus, 'pending' | 'error'>) {
  const errors: unknown[] = [];
  const row = await guard(() => render(undefined, -1, status), errors);
  if (errors.length > 0) console.error(`<VirtualList.Items> children threw for the "${status}" row.`, errors[0]);
  return row;
}

/** Calls `fn`, turning a throw or a rejected promise into `null` and recording the error. */
function guard(fn: () => ReactNode, errors: unknown[]): ReactNode {
  try {
    const row = fn();
    return isPromise(row)
      ? row.then(
          (value) => value,
          (error: unknown) => {
            errors.push(error);
            return null;
          },
        )
      : row;
  } catch (error) {
    errors.push(error);
    return null;
  }
}

function isPromise(value: unknown): value is Promise<ReactNode> {
  return value instanceof Promise;
}
