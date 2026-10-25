'use client';

import { keepPreviousData, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';
import { VirtualList, type Range } from '#virtual-list';
import type { User } from '@/lib/data';
import { firstRange, PAGE, usersQueryKey, type UsersWindow } from '@/lib/users-query';

export function ReactQueryClientProvider(props: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}

export function UserList({ total }: { total: number }) {
  const [range, setRange] = useState<Range>(() => firstRange(total));
  const { data } = useQuery({
    queryKey: usersQueryKey(total, range),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/users?start=${range.start}&end=${range.end}&total=${total}`, { signal });
      return { start: range.start, items: (await res.json()) as User[] } satisfies UsersWindow;
    },
  });

  return (
    <VirtualList.Root
      data={data?.items ?? []}
      offset={data?.start ?? 0}
      count={total}
      itemSize={32}
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
