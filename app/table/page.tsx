import { HydrationBoundary } from '@tanstack/react-query';
import { getN } from '@/lib/data';
import { prefetchFirstUsers } from '@/lib/users-prefetch';
import { ReactQueryClientProvider } from '../_components/user-list';
import { UserTable } from '../_components/user-table';

// A table built on the headless hooks: rows and columns are both virtualized.
export default async function Page({ searchParams }: PageProps<'/table'>) {
  const total = await getN(searchParams);
  return (
    <main>
      <h1>Client Component + table (hooks)</h1>
      <p>{total.toLocaleString()} users × 50 columns</p>
      <ReactQueryClientProvider>
        <HydrationBoundary state={await prefetchFirstUsers(total)}>
          <UserTable total={total} />
        </HydrationBoundary>
      </ReactQueryClientProvider>
    </main>
  );
}
