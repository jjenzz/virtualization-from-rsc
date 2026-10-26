import { HydrationBoundary } from '@tanstack/react-query';
import { getN } from '@/lib/data';
import { prefetchFirstUsers } from '@/lib/users-prefetch';
import { ReactQueryClientProvider, UserList } from '../_components/user-list';

// Client list: React Query loads the visible ranges; the list only renders them.
export default async function Page({ searchParams }: PageProps<'/client'>) {
  const total = await getN(searchParams);
  return (
    <main>
      <h1>Client Component + fetch on scroll</h1>
      <p>{total.toLocaleString()} users</p>
      <ReactQueryClientProvider>
        <HydrationBoundary state={await prefetchFirstUsers(total)}>
          <UserList total={total} />
        </HydrationBoundary>
      </ReactQueryClientProvider>
    </main>
  );
}
