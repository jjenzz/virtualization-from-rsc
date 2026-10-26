'use client';

import type { ComponentProps } from 'react';
import { useVirtualizerContext } from './root';
import { useVirtualizerViewport } from './use-virtualizer';

/** The scroll container. Give it a height with CSS. */
export function Viewport({ style, onScroll, onPointerDown, ...props }: ComponentProps<'div'>) {
  const viewport = useVirtualizerViewport(useVirtualizerContext());
  return (
    <div
      {...props}
      ref={viewport.ref}
      style={{ ...viewport.props.style, ...style }}
      onPointerDown={(event) => {
        viewport.props.onPointerDown(event);
        onPointerDown?.(event);
      }}
      onScroll={(event) => {
        viewport.props.onScroll(event);
        onScroll?.(event);
      }}
    />
  );
}
