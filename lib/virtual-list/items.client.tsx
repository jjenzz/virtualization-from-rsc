'use client';

import type { ReactNode } from 'react';
import { Items as ItemsImpl } from './items';
import { useDataContext } from './root';
import type { ItemsProps } from './types';

/**
 * Client build of <VirtualList.Items>. Renders the visible items from the
 * dataset on every render (items not in `items` yet have status "pending"), and reports the
 * visible range so the app can load what's missing. It never calls
 * `dataset.getItems`: on the client, the app loads data and passes `items`.
 */
export function Items<T>({ children: render }: ItemsProps<T>): ReactNode {
  const items = useDataContext<T>();
  if (items.getItems) {
    // Every row would stay "pending" forever, so fail loudly instead.
    throw new Error(
      '<VirtualList.Items> in a client component got a dataset with getItems. The client list never calls it: ' +
        'load the data in your app (e.g. with React Query, from onRangeChange) and pass it as createDataset({ items }).',
    );
  }
  return (
    <ItemsImpl isPending={(index) => items.itemAt(index) === undefined}>
      {(index) => {
        const item = items.itemAt(index);
        return item === undefined ? render(undefined, index, 'pending') : render(item, index, 'loaded');
      }}
    </ItemsImpl>
  );
}
