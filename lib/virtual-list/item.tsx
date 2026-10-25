'use client';

import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { useRootContext } from './root';

export const ItemContext = createContext<{ index: number; count: number } | null>(null);

/**
 * One row. Rows sit in normal flow under a spacer that <VirtualList.Items> sizes,
 * so they need no position of their own. With `itemSize` each row gets that
 * height; with `defaultItemSize` rows size themselves and are measured here.
 * Don't give rows vertical margins: they aren't measured.
 */
export function Item({ style, ...props }: ComponentProps<'div'>) {
  const item = useContext(ItemContext);
  if (!item) throw new Error('<VirtualList.Item> must be rendered by <VirtualList.Items>.');
  const { itemSize, measure, observe } = useRootContext();
  const ref = useRef<HTMLDivElement>(null);
  const index = item.index;

  // Measured before paint, so a row taller or shorter than the default is
  // accounted for (and the view kept still) without a visible jump; Root's shared
  // observer catches later changes, like an image loading.
  useLayoutEffect(() => {
    if (itemSize !== undefined) return;
    const element = ref.current!;
    measure(index, element.getBoundingClientRect().height);
    return observe(element, index);
  }, [itemSize, index, measure, observe]);

  return (
    <div
      role="listitem"
      aria-setsize={item.count}
      aria-posinset={item.index + 1}
      data-index={item.index}
      {...props}
      ref={ref}
      style={{ height: itemSize, ...style }}
    >
      {props.children}
    </div>
  );
}
