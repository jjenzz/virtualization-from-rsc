import { createDataset } from './dataset';
import { Layout } from './layout';
import { createLimit, registerList } from './list-store.server';
import { Root as ClientRoot, type RootProps } from './root';
import { DEFAULT_RANGE_SIZE } from './types';

/** `getItems` calls a list runs at once, across all of its groups' `Items`. */
const FETCH_CONCURRENCY = 4;

/**
 * Server build of <VirtualList.Root>. Registers `data` (with `offset`), `count` and
 * `rangeSize` under its `id`, so parts that read the data (`Items`, `Groups`) can find them through `rootId`, then
 * renders the client Root without `data`: a dataset is a class instance (and may
 * hold `getItems`), so it can't be sent to the browser.
 */
export function Root({ data, offset, count, ...props }: RootProps) {
  const dataset = data === undefined ? undefined : createDataset(data, { offset });
  const resolvedCount = count ?? dataset?.defaultCount;
  if (resolvedCount === undefined) {
    throw new Error('<VirtualList.Root> needs count (or data it can be worked out from, like an items array).');
  }
  if (dataset) {
    if (!props.id) {
      throw new Error(
        '<VirtualList.Root data={…}> in a Server Component needs an id, and parts that need ' +
          "the data pass it as rootId (Server Components can't read context).",
      );
    }
    const layout = new Layout(resolvedCount);
    registerList(props.id, {
      dataset,
      count: layout.itemCount,
      layout,
      rangeSize: props.rangeSize ?? DEFAULT_RANGE_SIZE,
      limit: createLimit(FETCH_CONCURRENCY),
    });
  }
  return <ClientRoot {...props} count={resolvedCount} />;
}
