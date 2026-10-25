import type { ReactNode } from 'react';
import { ItemsStream } from './items-stream';
import { indicesOf, type ItemsProps, type Range } from './types';

/** Items per streamed chunk after the first range. Fewer, larger chunks mean far
 * fewer promises, which matters a lot in React's dev build. */
const CHUNK_SIZE = 1000;

/** Waits for a later turn of the event loop, so pending HTML can be sent first. */
const nextTick = () =>
  new Promise<void>((resolve) => (typeof setImmediate === 'function' ? setImmediate(resolve) : setTimeout(resolve, 0)));

/**
 * Server build of <VirtualList.Items>. `children` runs only here, once per item.
 * The first `rangeSize` items are awaited so they're in the first HTML chunk; the
 * rest follow in chunks of CHUNK_SIZE, each passed down as a promise that React
 * streams in the same response. If the dataset has `queryFn`, each chunk's data is
 * loaded just before that chunk is rendered; otherwise it's read from `items`.
 * If `queryFn` throws, that chunk's rows render with status "error" and the rest of
 * the list carries on. Nothing is loaded after the page arrives.
 */
export async function Items<T>({ data: dataset, children: render }: ItemsProps<T>): Promise<ReactNode> {
  const { count, rangeSize } = dataset;

  // Renders a range. If `queryFn` throws, the range's items render with status
  // "error" instead, so one failed chunk doesn't affect the rest of the list.
  const renderRange = async (range: Range): Promise<ReactNode[]> => {
    const indices = indicesOf(range);
    let data: (T | undefined)[];
    try {
      data = dataset.queryFn ? await dataset.queryFn(range) : indices.map((i) => dataset.itemAt(i));
    } catch (error) {
      console.error(`<VirtualList.Items> queryFn failed for items ${range.start}-${range.end - 1}.`, error);
      return indices.map((index) => render(undefined, index, 'error'));
    }
    return indices.map((index, k) => {
      const item = data[k];
      return item === undefined ? render(undefined, index, 'missing') : render(item, index, 'loaded');
    });
  };

  const first = await renderRange({ start: 0, end: Math.min(count, rangeSize) });

  // One promise per later chunk, all created here so none is chained to another
  // (chaining them made React's dev build very slow, and overflow the stack at ~1M items).
  const pending: { range: Range; resolve: (rows: ReactNode[]) => void }[] = [];
  const chunks: Promise<ReactNode[]>[] = [];
  for (let start = first.length; start < count; start += CHUNK_SIZE) {
    const { promise, resolve } = Promise.withResolvers<ReactNode[]>();
    pending.push({ range: { start, end: Math.min(count, start + CHUNK_SIZE) }, resolve });
    chunks.push(promise);
  }

  // Render the chunks one after another, each on a later tick. Starting them all
  // straight away would load, build and serialize every row before the first
  // HTML is sent. Every chunk resolves with one row per index, so rows after a
  // problem keep their positions.
  void (async () => {
    for (const { range, resolve } of pending) {
      await nextTick();
      try {
        resolve(await renderRange(range));
      } catch (error) {
        // `children` itself threw: leave these rows empty.
        console.error(`<VirtualList.Items> children threw for items ${range.start}-${range.end - 1}.`, error);
        resolve(indicesOf(range).map(() => null));
      }
    }
  })();

  return <ItemsStream count={count} first={first} chunks={chunks} />;
}
