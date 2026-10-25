'use client';

import { createContext, useContext, type ComponentProps } from 'react';
import { useRootContext } from './root';

export const ItemContext = createContext<{ index: number; count: number } | null>(null);

/** One row. Positions itself from the index that <VirtualList.Items> provides. */
export function Item({ style, ...props }: ComponentProps<'div'>) {
  const item = useContext(ItemContext);
  if (!item) throw new Error('<VirtualList.Item> must be rendered by <VirtualList.Items>.');
  const { itemSize } = useRootContext();

  return (
    <div
      role="listitem"
      aria-setsize={item.count}
      aria-posinset={item.index + 1}
      data-index={item.index}
      {...props}
      style={{ position: 'absolute', insetInline: 0, top: item.index * itemSize, height: itemSize, ...style }}
    >
      {props.children}
    </div>
  );
}
