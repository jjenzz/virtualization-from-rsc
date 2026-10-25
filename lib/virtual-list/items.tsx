'use client';

import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { ItemContext } from './item';
import { useRootContext } from './root';
import { indicesOf, type Range } from './types';

/**
 * Full-height list element with the visible items inside. Shared by both builds.
 * Until the viewport is measured (server render, hydration) it renders the first
 * `initialCount` items, so the server and the first client render match.
 */
export function Items({
  count,
  initialCount,
  onRangeChange,
  children,
}: {
  count: number;
  initialCount: number;
  onRangeChange?: (range: Range) => void;
  children: (index: number) => ReactNode;
}) {
  const { itemSize, overscan, scrollTop, viewportHeight } = useRootContext();
  const handleRangeChange = useEffectEvent((next: Range) => onRangeChange?.(next));

  const range: Range =
    viewportHeight === 0
      ? { start: 0, end: Math.min(count, initialCount) }
      : {
          start: Math.max(0, Math.floor(scrollTop / itemSize) - overscan),
          end: Math.min(count, Math.ceil((scrollTop + viewportHeight) / itemSize) + overscan),
        };

  useEffect(() => {
    handleRangeChange(range);
  }, [range.start, range.end]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div role="list" style={{ position: 'relative', height: count * itemSize }}>
      {indicesOf(range).map((index) => (
        <ItemContext key={index} value={{ index, count }}>
          {children(index)}
        </ItemContext>
      ))}
    </div>
  );
}
