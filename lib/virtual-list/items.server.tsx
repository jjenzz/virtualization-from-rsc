import type { ReactNode } from 'react';
import { ItemsStream, type Slice } from './items-stream';
import { getList } from './list-store.server';
import { fetchRows, renderRows, renderTemplate, type Fetched } from './render-rows.server';
import { indicesOf, type ItemsProps, type Range } from './types';

/** Items in the first chunk, sent with the first HTML. */
const FIRST_CHUNK_SIZE = 50;

/**
 * Items per page after the first chunk. Pages are fixed and known up front: the
 * client gets one promise per page, and each page is the unit of data fetching.
 */
const PAGE_SIZE = 1000;

/** Page fetches allowed to run ahead of rendering at once. */
const FETCH_CONCURRENCY = 4;

/**
 * Target time for each turn of rendering, including React serializing what was
 * rendered. Keeping every turn short lets the framework's HTML pipeline (however
 * many steps it has) send what's ready between turns, without tuning per framework.
 */
const TURN_BUDGET_MS = 10;

/** Smallest slice, so a very slow row doesn't produce one promise per row. */
const MIN_SLICE_SIZE = 10;

/** Waits for a later turn of the event loop. */
const nextTick = () =>
  new Promise<void>((resolve) => (typeof setImmediate === 'function' ? setImmediate(resolve) : setTimeout(resolve, 0)));

const now = () => performance.now();

function split(range: Range, size: number): Range[] {
  const ranges: Range[] = [];
  for (let start = range.start; start < range.end; start += size) {
    ranges.push({ start, end: Math.min(range.end, start + size) });
  }
  return ranges;
}

/**
 * Server build of <VirtualList.Items>. `children` runs only here, once per item.
 * The first FIRST_CHUNK_SIZE items are awaited so they're in the first HTML chunk.
 * The rest is split into fixed pages; each page resolves to slices sized so that
 * rendering and serializing a slice takes about TURN_BUDGET_MS, measured as we go
 * (about a page per slice in production, a few dozen rows in React's dev build).
 * Up to FETCH_CONCURRENCY pages are fetched in parallel ahead of rendering; pages
 * and slices are still rendered and sent in order.
 *
 * Rows not arrived yet show `children(undefined, -1, 'pending')`; if `getItems` throws,
 * its rows render with status "error"; if the stream fails, rows that never arrived
 * show `children(undefined, -1, 'error')` (see render-rows.server.ts).
 */
export async function Items<T>({ rootId, children: render }: ItemsProps<T>): Promise<ReactNode> {
  // Read before any await: the dataset and layout values Root registered under its id.
  const { dataset, count, rangeSize } = getList<T>(rootId, 'Items');

  const fetchRange = (range: Range) =>
    fetchRows<T>((r) => (dataset.getItems ? dataset.getItems(r) : indicesOf(r).map((i) => dataset.itemAt(i))), range);

  const firstRange = { start: 0, end: Math.min(count, FIRST_CHUNK_SIZE) };
  const pageRanges = split({ start: firstRange.end, end: count }, PAGE_SIZE);

  // Fetch in parallel, render in order. Up to FETCH_CONCURRENCY page fetches run
  // ahead of the render loop; each time it takes a page, the next fetch starts.
  const fetches: Promise<Fetched<T>>[] = [];
  let rendered = 0;
  const fetchAhead = () => {
    while (fetches.length < pageRanges.length && fetches.length < rendered + FETCH_CONCURRENCY) {
      fetches.push(fetchRange(pageRanges[fetches.length]));
    }
  };

  const firstFetched = await fetchRange(firstRange);
  // Start the page fetches only now: started alongside the first chunk, their
  // results arrived with it and delayed the first HTML.
  fetchAhead();
  const [first, placeholder, errorRow] = await Promise.all([
    renderRows(render, firstRange, firstFetched, 0),
    renderTemplate(render, 'pending'),
    renderTemplate(render, 'error'),
  ]);

  // One promise per page, all created here so none is chained to another
  // (chaining them made React's dev build very slow, and overflow the stack at ~1M items).
  const pages = pageRanges.map(() => Promise.withResolvers<Promise<Slice>[]>());

  void (async () => {
    // Measured cost per row (render + serialize), smoothed. Starts unknown, so the
    // first page uses small slices and later pages adjust to what was measured.
    let msPerRow: number | undefined;
    for (let k = 0; k < pageRanges.length; k++) {
      await nextTick();
      const page = pageRanges[k];
      const fetched = await fetches[k];
      rendered = k + 1;
      fetchAhead();

      const sliceSize =
        msPerRow === undefined
          ? FIRST_CHUNK_SIZE
          : Math.max(MIN_SLICE_SIZE, Math.min(PAGE_SIZE, Math.floor(TURN_BUDGET_MS / msPerRow)));
      const sliceRanges = split(page, sliceSize);
      const slices = sliceRanges.map(() => Promise.withResolvers<Slice>());
      pages[k].resolve(slices.map((s) => s.promise));

      for (let j = 0; j < sliceRanges.length; j++) {
        const range = sliceRanges[j];
        await nextTick();
        const started = now();
        const rows = await renderRows(render, range, fetched, page.start);
        slices[j].resolve({ start: range.start, rows });
        // React serializes the resolved slice before we get the next turn, so the
        // time until then is the slice's full cost.
        await nextTick();
        const sample = (now() - started) / rows.length;
        msPerRow = msPerRow === undefined ? sample : msPerRow * 0.7 + sample * 0.3;
      }
    }
  })();

  return (
    <ItemsStream first={first} placeholder={placeholder} errorRow={errorRow} pages={pages.map((p) => p.promise)} />
  );
}
