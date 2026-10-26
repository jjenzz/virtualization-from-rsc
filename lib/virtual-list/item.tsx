'use client';

import { createContext, useContext, type ComponentProps } from 'react';
import { useVirtualizerContext } from './root';
import { useVirtualizerItem } from './use-virtualizer';

/**
 * The item's index (counting items only), its row (counting group labels too), the
 * item total, and whether the row is a placeholder (its item hasn't arrived).
 */
export const ItemContext = createContext<{ index: number; row: number; count: number; pending: boolean } | null>(null);

/**
 * One row. Rows sit in normal flow under a spacer that <VirtualList.Items> sizes,
 * so they need no position of their own. With `itemSize` each row gets that
 * height; with `defaultItemSize` rows size themselves and are measured.
 * Don't give rows vertical margins: they aren't measured.
 */
export function Item({ style, ...props }: ComponentProps<'div'>) {
  const item = useContext(ItemContext);
  if (!item) throw new Error('<VirtualList.Item> must be rendered by <VirtualList.Items>.');
  const { ref, props: itemProps } = useVirtualizerItem(useVirtualizerContext(), item);
  return (
    <div
      role="listitem"
      aria-setsize={item.count}
      aria-posinset={item.index + 1}
      {...itemProps}
      {...props}
      ref={ref}
      style={{ ...itemProps.style, ...style }}
    />
  );
}
