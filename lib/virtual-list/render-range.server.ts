'use server';

import type { ReactNode } from 'react';
import type { GetItems } from './dataset';
import { fetchRows, renderRows } from './render-rows.server';
import type { Range, RenderItem } from './types';

/** Largest range one call renders. This is a public endpoint, so don't trust the range. */
const MAX_RANGE_SIZE = 1000;

/**
 * Fetches a range with `getItems` and renders it with `render`, in one request.
 * Server `Items` binds the consumer's two server functions to it
 * and the list's `count` (`renderRange.bind(null, getItems, render, count)`) and
 * hands the result to its client half, which calls it with each range it needs
 * while scrolling. Ranges are clamped to `count`, as in streaming mode.
 *
 * Errors behave as in streaming mode (see render-rows.server.ts).
 */
export async function renderRange<T>(
  getItems: GetItems<T>,
  render: RenderItem<T>,
  count: number,
  range: Range,
): Promise<ReactNode[]> {
  const start = Math.max(0, Math.floor(Number(range?.start)));
  const end = Math.min(start + MAX_RANGE_SIZE, Math.floor(Number(count)), Math.floor(Number(range?.end)));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const safeRange = { start, end };

  return renderRows(render, safeRange, await fetchRows(getItems, safeRange), start);
}
