'use client';

import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { useRootContext } from './root';

/**
 * The item's index (counting items only), its row (counting group labels too), the
 * item total, and whether the row is a placeholder (its item hasn't arrived).
 */
export const ItemContext = createContext<{ index: number; row: number; count: number; pending: boolean } | null>(null);

/**
 * One row. Rows sit in normal flow under a spacer that <VirtualList.Items> sizes,
 * so they need no position of their own. With `itemSize` each row gets that
 * height; with `defaultItemSize` rows size themselves and are measured here.
 * Don't give rows vertical margins: they aren't measured.
 */
export function Item({ style, ...props }: ComponentProps<'div'>) {
  const item = useContext(ItemContext);
  if (!item) throw new Error('<VirtualList.Item> must be rendered by <VirtualList.Items>.');
  const { itemSize, onRowMount } = useRootContext();
  const ref = useRef<HTMLDivElement>(null);
  const { row, pending } = item;

  useLayoutEffect(() => {
    if (itemSize !== undefined) return;
    // A placeholder is measured for layout but kept out of the average item height.
    return onRowMount(ref.current!, row, !pending);
  }, [itemSize, row, pending, onRowMount]);

  return (
    <div
      role="listitem"
      aria-setsize={item.count}
      aria-posinset={item.index + 1}
      data-index={item.index}
      data-row-index={item.row}
      {...props}
      ref={ref}
      style={{ height: itemSize, ...style }}
    >
      {props.children}
    </div>
  );
}
