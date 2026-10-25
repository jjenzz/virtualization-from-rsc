import { createDataset } from './dataset';
import { registerList } from './list-store.server';
import { Root as ClientRoot, type RootProps } from './root';
import { DEFAULT_RANGE_SIZE } from './types';

/**
 * Server build of <VirtualList.Root>. Registers `data` (with `offset`), `count` and
 * `rangeSize` under its `id`, so other parts can find them through `rootId`, then
 * renders the client Root without `data`: a dataset is a class instance (and may
 * hold `getItems`), so it can't be sent to the browser.
 */
export function Root({ data, offset, ...props }: RootProps) {
  if (data) {
    if (!props.id) {
      throw new Error(
        '<VirtualList.Root data={…}> in a Server Component needs an id, and parts that need ' +
          "the data pass it as rootId (Server Components can't read context).",
      );
    }
    registerList(props.id, {
      dataset: createDataset(data, { offset }),
      count: props.count,
      rangeSize: props.rangeSize ?? DEFAULT_RANGE_SIZE,
    });
  }
  return <ClientRoot {...props} />;
}
