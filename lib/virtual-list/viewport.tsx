'use client';

import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { useRootContext } from './root';

/** The scroll container. Give it a height with CSS. */
export function Viewport({ style, onScroll, ...props }: ComponentProps<'div'>) {
  const { setScrollTop, setViewportHeight } = useRootContext();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current!;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    setViewportHeight(element.clientHeight);
    // The user may have scrolled before hydration, and React doesn't replay that scroll event.
    setScrollTop(element.scrollTop);
    return () => observer.disconnect();
  }, [setViewportHeight, setScrollTop]);

  return (
    <div
      {...props}
      ref={ref}
      style={{ overflow: 'auto', ...style }}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
        onScroll?.(event);
      }}
    />
  );
}
