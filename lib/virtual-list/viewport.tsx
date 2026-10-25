'use client';

import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { useRootContext } from './root';

/** The scroll container. Give it a height with CSS. */
export function Viewport({ style, onScroll, onPointerDown, ...props }: ComponentProps<'div'>) {
  const { setScrollTop, setViewportHeight, viewportRef, captureAnchor, setDragging } = useRootContext();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current!;
    viewportRef.current = element;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    setViewportHeight(element.clientHeight);
    // The user may have scrolled before hydration, and React doesn't replay that scroll event.
    setScrollTop(element.scrollTop);
    return () => {
      observer.disconnect();
      viewportRef.current = null;
    };
  }, [setViewportHeight, setScrollTop, viewportRef]);

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
          setDragging(true);
          const release = () => {
            setDragging(false);
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
          };
          window.addEventListener('pointerup', release);
          window.addEventListener('pointercancel', release);
        }
        onPointerDown?.(event);
      }}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
        captureAnchor();
        onScroll?.(event);
      }}
    />
  );
}
