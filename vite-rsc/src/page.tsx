import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { ReactQueryClientProvider, UserList } from '../../app/_components/user-list';
import { getUsersRange, type User } from '../../lib/data';
import { firstRange, usersQueryKey, type UsersWindow } from '../../lib/users-query';
import { createDataset, VirtualList } from '../../lib/virtual-list/index.server';

const row = { display: 'flex', gap: 16, padding: '0 12px', alignItems: 'center' };

// The same three lists as the Next demo's app/page.tsx.
export async function Page({ n }: { n: string | null }) {
  const total = Math.min(Math.max(Number(n) || 5000, 1), 1_000_000);

  const usersStream = createDataset({
    getItems: ({ start, end }) => getUsersRange(start, end, total),
  });

  const usersOnScroll = createDataset({
    getItems: async ({ start, end }) => {
      'use server';
      return getUsersRange(start, end, total);
    },
  });

  // The client list's first range, prefetched and handed to its React Query cache.
  const queryClient = new QueryClient();
  const first = firstRange(total);
  await queryClient
    .query({
      queryKey: usersQueryKey(total, first),
      queryFn: async (): Promise<UsersWindow> => ({
        start: 0,
        items: await getUsersRange(first.start, first.end, total),
      }),
    })
    .catch(() => {});

  return (
    <main style={{ fontFamily: 'system-ui', padding: 16 }}>
      <h1>{total.toLocaleString()} users (Vite RSC)</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <section>
          <h2>Server Component + stream rows</h2>
          <VirtualList.Root id="users" data={usersStream} count={total} itemSize={32}>
            <VirtualList.Viewport className="viewport">
              <VirtualList.Items<User> rootId="users">
                {(user, index, status) => {
                  return user ? (
                    <VirtualList.Item style={row}>
                      <span className="id">#{user.id}</span>
                      <span className="name">{user.name}</span>
                      <span className="email">{user.email}</span>
                    </VirtualList.Item>
                  ) : status === 'pending' ? (
                    <VirtualList.Item style={row} data-pending="">
                      Loading…
                    </VirtualList.Item>
                  ) : status === 'missing' ? (
                    <VirtualList.Item style={row}>No user at {index}</VirtualList.Item>
                  ) : (
                    <VirtualList.Item style={row}>Couldn&apos;t load this row</VirtualList.Item>
                  );
                }}
              </VirtualList.Items>
            </VirtualList.Viewport>
          </VirtualList.Root>
        </section>

        <section>
          <h2>Server Component + load server function on scroll</h2>
          <VirtualList.Root id="users-on-scroll" data={usersOnScroll} count={total} itemSize={32}>
            <VirtualList.Viewport className="viewport">
              <VirtualList.Items<User> rootId="users-on-scroll">
                {async (user, index, status) => {
                  'use server';
                  return user ? (
                    <VirtualList.Item style={row}>
                      <span className="id">#{user.id}</span>
                      <span className="name">{user.name}</span>
                      <span className="email">{user.email}</span>
                    </VirtualList.Item>
                  ) : status === 'pending' ? (
                    <VirtualList.Item style={row} data-pending="">
                      Loading…
                    </VirtualList.Item>
                  ) : status === 'missing' ? (
                    <VirtualList.Item style={row}>No user at {index}</VirtualList.Item>
                  ) : (
                    <VirtualList.Item style={row}>Couldn&apos;t load this row</VirtualList.Item>
                  );
                }}
              </VirtualList.Items>
            </VirtualList.Viewport>
          </VirtualList.Root>
        </section>

        <section>
          <h2>Client Component + fetch on scroll</h2>
          <ReactQueryClientProvider>
            <HydrationBoundary state={dehydrate(queryClient)}>
              <UserList total={total} />
            </HydrationBoundary>
          </ReactQueryClientProvider>
        </section>
      </div>
    </main>
  );
}
