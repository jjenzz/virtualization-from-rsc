import { createDataset, VirtualList } from '#virtual-list';
import { getN, getUsersRange } from '@/lib/data';
import { ReactQueryClientProvider, UserList } from './_components/user-list';
import { RetryButton } from './_components/retry-button';

// Both demos side by side, both rendering items from a dataset.
// Server list: the list calls `queryFn` while the server streams it.
// Client list: React Query loads the visible pages; the list only renders them.
export default async function Page({ searchParams }: PageProps<'/'>) {
  const total = await getN(searchParams);
  const users = createDataset({
    queryFn: ({ start, end }) => getUsersRange(start, end, total),
    rangeSize: 50,
    count: total,
  });

  return (
    <main>
      <h1>{total.toLocaleString()} users</h1>
      <div className="demos">
        <section>
          <h2>Server Component</h2>
          <VirtualList.Root itemSize={32}>
            <VirtualList.Viewport className="viewport">
              <VirtualList.Items data={users}>
                {(user, index, status) => {
                  if (!user) return null;
                  return status === 'error' ? (
                    <VirtualList.Item key={index} className="row" data-error="">
                      Couldn&apos;t load this row <RetryButton />
                    </VirtualList.Item>
                  ) : (
                    <VirtualList.Item key={user.id} className="row">
                      <span className="name">{user.name}</span>
                      <span className="email">{user.email}</span>
                      <span className="age">{user.age}</span>
                    </VirtualList.Item>
                  );
                }}
              </VirtualList.Items>
            </VirtualList.Viewport>
          </VirtualList.Root>
        </section>

        <section>
          <ReactQueryClientProvider>
            <UserList total={total} initialPage={await getUsersRange(0, 50, total)} />
          </ReactQueryClientProvider>
        </section>
      </div>
    </main>
  );
}
