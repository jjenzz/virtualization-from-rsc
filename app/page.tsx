import { createDataset, VirtualList } from '#virtual-list';
import { getN, getUsersRange, type User } from '@/lib/data';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { ReactQueryClientProvider, UserList } from './_components/user-list';
import { firstRange, usersQueryKey, type UsersWindow } from '@/lib/users-query';
import { RetryButton } from './_components/retry-button';

export default async function Page({ searchParams }: PageProps<'/'>) {
  const total = await getN(searchParams);
  const usersStream = createDataset({
    getItems: ({ start, end }) => getUsersRange(start, end, total),
  });

  // The client list's first range, prefetched here and handed to its cache, so its
  // first rows are in the HTML and it doesn't fetch them again.
  const queryClient = new QueryClient();
  const first = firstRange(total);
  await queryClient
    .query({
      queryKey: usersQueryKey(total, first),
      queryFn: async (): Promise<UsersWindow> => ({
        items: await getUsersRange(first.start, first.end, total),
        start: 0,
      }),
    })
    .catch(() => {});

  return (
    <main>
      <h1>{total.toLocaleString()} users</h1>
      <div className="demos">
        <section>
          <h2>Server Component + stream rows</h2>
          <VirtualList.Root id="users" data={usersStream} count={total} defaultItemSize={45}>
            <VirtualList.Viewport className="viewport">
              <VirtualList.Items<User> rootId="users">
                {async (user, index, status) => {
                  return user ? (
                    <VirtualList.Item className="row">
                      <span className="id">#{user.id}</span>
                      <span className="name">{user.name}</span>
                      <span className="email">{user.email}</span>
                      <span className="age">{user.age}</span>
                      {user.bio && <span className="bio">{user.bio}</span>}
                    </VirtualList.Item>
                  ) : status === 'pending' ? (
                    <VirtualList.Item className="row" data-pending="">
                      Loading…
                    </VirtualList.Item>
                  ) : status === 'error' ? (
                    <VirtualList.Item className="row" data-error="">
                      Couldn&apos;t load row {index} <RetryButton />
                    </VirtualList.Item>
                  ) : null;
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
