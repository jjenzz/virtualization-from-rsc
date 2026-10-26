'use client';

import type { ReactNode } from 'react';
import { GroupsFrame } from './group';

/** Client half of the server build of <VirtualList.Groups>: places the server-rendered groups. */
export function GroupsStream({ groups }: { groups: ReactNode[] }) {
  return <GroupsFrame renderGroup={(index) => groups[index]} />;
}
