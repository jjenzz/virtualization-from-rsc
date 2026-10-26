'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { useGroupContext } from './group';
import { ItemContext } from './item';
import { useListHeight, useRangeContext, useRootContext, useSizesContext } from './root';
import { indicesOf, type Range } from './types';

/**
 * The rendered items, shared by both builds. Re-renders when the range changes
 * (the range context only changes then), not on every scroll event.
 *
 * In a flat list it's the full-height list element: the items sit in normal flow
 * under a spacer as tall as everything above them, so they need no position of
 * their own and can have different heights. Inside a `Group` it renders just that
 * group's rendered items; `Groups` provides the list element and the spacer.
 */
export function Items({
  children,
  isPending,
}: {
  children: (index: number) => ReactNode;
  /** Whether item `index` is a placeholder (not arrived yet). */
  isPending: (index: number) => boolean;
}) {
  const { count, layout } = useRootContext();
  const sizes = useSizesContext();
  const listHeight = useListHeight();
  const range = useRangeContext();
  const group = useGroupContext();

  if (group) {
    return indicesOf(intersect(group.items, range.items)).map((index) => (
      <ItemsView key={index} index={index} row={layout.rowOfItem(index)} count={count} pending={isPending(index)}>
        {children(index)}
      </ItemsView>
    ));
  }
  if (layout.grouped) {
    throw new Error(
      '<VirtualList.Items> in a grouped list goes inside <VirtualList.Group>, under <VirtualList.Groups>.',
    );
  }
  return (
    <div role="list" style={{ height: listHeight }}>
      <div aria-hidden style={{ height: sizes.start(range.rows.start) }} />
      {indicesOf(range.items).map((index) => (
        <ItemsView key={index} index={index} row={index} count={count} pending={isPending(index)}>
          {children(index)}
        </ItemsView>
      ))}
    </div>
  );
}

function intersect(a: Range, b: Range): Range {
  const start = Math.max(a.start, b.start);
  return { start, end: Math.max(start, Math.min(a.end, b.end)) };
}

/**
 * Gives one row its index. Memoized with a stable context value, so a row that
 * stays on screen doesn't re-render when the range shifts (as long as `children`
 * returns the same element for it, which the streamed server list does).
 */
const ItemsView = memo(function ItemsView({
  index,
  row,
  count,
  pending,
  children,
}: {
  index: number;
  row: number;
  count: number;
  pending: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ index, row, count, pending }), [index, row, count, pending]);
  return <ItemContext value={value}>{children}</ItemContext>;
});
