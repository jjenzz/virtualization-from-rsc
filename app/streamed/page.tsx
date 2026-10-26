import { createDataset, VirtualList } from '#virtual-list';
import { getN, getUsersRange, type User } from '@/lib/data';
import { RetryButton } from '../_components/retry-button';

// Server list: the list calls `getItems` while the server streams it.
export default async function Page({ searchParams }: PageProps<'/streamed'>) {
  const total = await getN(searchParams);
  const users = createDataset({
    getItems: ({ start, end }) => getUsersRange(start, end, total),
  });

  return (
    <main>
      <h1>Server Component + stream rows</h1>
      <p>{total.toLocaleString()} users</p>
      <VirtualList.Root id="users" data={users} count={total} defaultItemSize={45}>
        <VirtualList.Viewport className="viewport">
          <VirtualList.Items<User> rootId="users">
            {(user, index, status) => {
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
    </main>
  );
}
