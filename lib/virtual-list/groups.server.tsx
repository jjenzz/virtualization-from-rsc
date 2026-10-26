import { Fragment, type ReactNode } from 'react';
import { GroupsStream } from './groups-stream';
import { getList } from './list-store.server';
import type { GroupsProps } from './types';

/**
 * Server build of <VirtualList.Groups>. Calls `children` for every group on the
 * server, so the function never reaches the browser; each group's `Items` streams
 * its own items (passing `groupIndex`). The client half mounts only the groups
 * with rows on screen.
 */
export function Groups<G>({ rootId, children: render }: GroupsProps<G>): ReactNode {
  const { dataset } = getList(rootId, 'Groups');
  const groups = dataset.groups as readonly G[] | undefined;
  if (!groups) {
    throw new Error('<VirtualList.Groups> needs a dataset with groups: createDataset({ getItems, groups }).');
  }
  // Keyed, because the groups reach the client in an array.
  return (
    <GroupsStream
      groups={groups.map((group, index) => (
        <Fragment key={index}>{render(group, index)}</Fragment>
      ))}
    />
  );
}
