'use client';

import type { ReactNode } from 'react';
import { GroupsFrame } from './group';
import { useDataContext } from './root';
import type { GroupsProps } from './types';

/** Client build of <VirtualList.Groups>: renders the groups that have rows on screen. */
export function Groups<G>({ children: render }: GroupsProps<G>): ReactNode {
  const groups = useDataContext<unknown>().groups as readonly G[] | undefined;
  if (!groups) {
    throw new Error(
      '<VirtualList.Groups> needs a dataset with groups: createDataset({ items, groups }) or { groups }.',
    );
  }
  return <GroupsFrame renderGroup={(index) => render(groups[index], index)} />;
}
