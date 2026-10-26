'use client';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';
import { VirtualList, type Range } from '#virtual-list';
import type { User } from '@/lib/data';
import { firstRange, PAGE, usersQuery } from '@/lib/users-query';

export function ReactQueryClientProvider(props: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}

export function UserList({ total }: { total: number }) {
  const [range, setRange] = useState<Range>(() => firstRange(total));
  const { data } = useQuery(usersQuery(total, range));

  return (
    <VirtualList.Root
      data={data?.items ?? []}
      offset={data?.start ?? 0}
      count={total}
      defaultItemSize={45}
      rangeSize={PAGE}
      onRangeChange={setRange}
    >
      <VirtualList.Viewport className="viewport">
        <VirtualList.Items<User>>
          {(user) => {
            return user ? (
              <VirtualList.Item className="row">
                <span className="id">#{user.id}</span>
                <span className="name">{user.name}</span>
                <span className="email">{user.email}</span>
                <span className="age">{user.age}</span>
                {user.bio && <span className="bio">{user.bio}</span>}
              </VirtualList.Item>
            ) : (
              <VirtualList.Item className="row" data-pending="">
                Loading…
              </VirtualList.Item>
            );
          }}
        </VirtualList.Items>
      </VirtualList.Viewport>
    </VirtualList.Root>
  );
}
