'use client';

import { createContext, useContext, useMemo, useState, type ComponentProps } from 'react';

type RootContextValue = {
  itemSize: number;
  overscan: number;
  scrollTop: number;
  setScrollTop: (value: number) => void;
  viewportHeight: number;
  setViewportHeight: (value: number) => void;
};

const RootContext = createContext<RootContextValue | null>(null);

export function useRootContext() {
  const context = useContext(RootContext);
  if (!context) throw new Error('VirtualList parts must be rendered inside <VirtualList.Root>.');
  return context;
}

export interface RootProps extends ComponentProps<'div'> {
  /** Fixed height of each item, in px. */
  itemSize: number;
  /** Extra items rendered above and below the visible range. */
  overscan?: number;
}

export function Root({ itemSize, overscan = 5, ...props }: RootProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const value = useMemo(
    () => ({ itemSize, overscan, scrollTop, setScrollTop, viewportHeight, setViewportHeight }),
    [itemSize, overscan, scrollTop, viewportHeight],
  );

  return (
    <RootContext value={value}>
      <div {...props} />
    </RootContext>
  );
}
