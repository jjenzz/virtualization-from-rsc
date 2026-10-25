'use client';

import { QueryClient, QueryClientProvider, useQueries } from '@tanstack/react-query';
import { type PropsWithChildren, useState } from 'react';
import { createDataset, VirtualList, type Range } from '#virtual-list';
import type { User } from '@/lib/data';
import { Placeholder, UserRow } from './user-row';

const PAGE = 50;

export function ReactQueryClientProvider(props: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
}

// Client tree: data down, actions up. The list reports the visible range; the
// app turns it into React Query queries and passes the results back as a dataset.
export function UserList({ total, initialPage }: { total: number; initialPage: User[] }) {
  const [range, setRange] = useState<Range>({ start: 0, end: PAGE });
  const pageNumbers = pagesIn(range);

  const results = useQueries({
    queries: pageNumbers.map((p) => ({
      queryKey: ['users', total, p],
      initialData: p === 0 ? initialPage : undefined,
      staleTime: Infinity,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const res = await fetch(`/api/users?start=${p * PAGE}&end=${(p + 1) * PAGE}&total=${total}`, { signal });
        return res.json() as Promise<User[]>;
      },
    })),
  });

  const users = createDataset({
    count: total,
    rangeSize: PAGE,
    items: Object.fromEntries(pageNumbers.map((p, i) => [p, results[i].data])),
  });

  return (
    <>
      <h2>Client Component</h2>
      <VirtualList.Root itemSize={32}>
        <VirtualList.Viewport className="viewport">
          <VirtualList.Items data={users} onRangeChange={setRange}>
            {(user, index) => {
              return user ? (
                <VirtualList.Item key={user.id} className="row">
                  <span className="name">{user.name}</span>
                  <span className="email">{user.email}</span>
                  <span className="age">{user.age}</span>
                </VirtualList.Item>
              ) : (
                <Placeholder key={index} />
              );
            }}
          </VirtualList.Items>
        </VirtualList.Viewport>
      </VirtualList.Root>
    </>
  );
}

/** Page numbers that cover a range of indices. */
function pagesIn({ start, end }: Range): number[] {
  const pages: number[] = [];
  for (let p = Math.floor(start / PAGE); p <= Math.floor((end - 1) / PAGE); p++) pages.push(p);
  return pages;
}
