'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { ItemContext } from './item';
import { useRangeContext, useRootContext, useSizesContext } from './root';
import { indicesOf } from './types';

/**
 * Full-height list element with the visible items inside. Shared by both builds.
 * The items sit in normal flow under a spacer as tall as all the items above them,
 * so they need no position of their own and can have different heights.
 * Until the viewport is measured (server render, hydration) it renders the first
 * `initialCount` items, so the server and the first client render match.
 *
 * Re-renders when the range changes (the range context only changes then), not
 * on every scroll event.
 */
export function Items({ initialCount, children }: { initialCount: number; children: (index: number) => ReactNode }) {
  const { count } = useRootContext();
  const sizes = useSizesContext();
  const range = useRangeContext() ?? { start: 0, end: Math.min(count, initialCount) };

  return (
    <div role="list" style={{ height: sizes.start(count) }}>
      <div aria-hidden style={{ height: sizes.start(range.start) }} />
      {indicesOf(range).map((index) => (
        <ItemsView key={index} index={index} count={count}>
          {children(index)}
        </ItemsView>
      ))}
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
  count,
  children,
}: {
  index: number;
  count: number;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ index, count }), [index, count]);
  return <ItemContext value={value}>{children}</ItemContext>;
});
