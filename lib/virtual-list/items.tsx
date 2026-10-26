'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { useGroupContext } from './group';
import { ItemContext } from './item';
import { useVirtualizerStateContext } from './root';
import { indicesOf } from './types';
import { useVirtualizerItems } from './use-virtualizer';

/**
 * The rendered items, shared by both builds. Re-renders when the range changes
 * (the state context only changes then, or when a row is measured), not on every
 * scroll event.
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
  const state = useVirtualizerStateContext();
  const { listStyle, spacerStyle, windowProps, indexes, rowOf } = useVirtualizerItems(state);
  const group = useGroupContext();

  const renderItem = (index: number) => (
    <ItemsView key={index} index={index} row={rowOf(index)} count={state.count} pending={isPending(index)}>
      {children(index)}
    </ItemsView>
  );

  if (group) return indicesOf(group.items).map(renderItem);
  if (state.layout.grouped) {
    throw new Error(
      '<VirtualList.Items> in a grouped list goes inside <VirtualList.Group>, under <VirtualList.Groups>.',
    );
  }
  return (
    <div role="list" style={listStyle}>
      <div aria-hidden style={spacerStyle} />
      <div {...windowProps}>{indexes.map(renderItem)}</div>
    </div>
  );
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
