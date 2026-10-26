'use client';

import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { useRootContext } from './root';

/** The scroll container. Give it a height with CSS. */
export function Viewport({ style, onScroll, onPointerDown, ...props }: ComponentProps<'div'>) {
  const root = useRootContext();
  const { onViewportResize, viewportRef } = root;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current!;
    viewportRef.current = element;
    const observer = new ResizeObserver(() => onViewportResize(element.clientHeight));
    observer.observe(element);
    onViewportResize(element.clientHeight);
    // The user may have scrolled before hydration, and React doesn't replay that scroll event.
    root.onScroll(element.scrollTop);
    return () => {
      observer.disconnect();
      viewportRef.current = null;
    };
  }, [onViewportResize, root.onScroll, viewportRef]);

  return (
    <div
      {...props}
      ref={ref}
      // The list keeps the view still itself when measured rows change height above it;
      // the browser's own scroll anchoring would fight that.
      style={{ overflow: 'auto', overflowAnchor: 'none', ...style }}
      onPointerDown={(event) => {
        // A press on the scroll container itself, not on a row, is the scrollbar.
        if (event.target === event.currentTarget) {
          root.onScrollbarDragChange(true);
          const release = () => {
            root.onScrollbarDragChange(false);
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
          };
          window.addEventListener('pointerup', release);
          window.addEventListener('pointercancel', release);
        }
        onPointerDown?.(event);
      }}
      onScroll={(event) => {
        // Only re-renders when the rendered row range changes, not on every scroll event.
        root.onScroll(event.currentTarget.scrollTop);
        onScroll?.(event);
      }}
    />
  );
}
