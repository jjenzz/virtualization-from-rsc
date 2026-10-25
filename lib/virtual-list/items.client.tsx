'use client';

import type { ReactNode } from 'react';
import { Items as ItemsImpl } from './items';
import type { ItemsProps } from './types';

/**
 * Client build of <VirtualList.Items>. Renders the visible items from the
 * dataset on every render (items not in `items` yet have status "pending"), and reports the
 * visible range so the app can load what's missing. It never calls
 * `dataset.queryFn`; the app can, e.g. from onRangeChange.
 */
export function Items<T>({ data: items, children: render, onRangeChange }: ItemsProps<T>): ReactNode {
  return (
    <ItemsImpl count={items.count} initialCount={items.rangeSize} onRangeChange={onRangeChange}>
      {(index) => {
        const item = items.itemAt(index);
        return item === undefined ? render(undefined, index, 'pending') : render(item, index, 'loaded');
      }}
    </ItemsImpl>
  );
}
