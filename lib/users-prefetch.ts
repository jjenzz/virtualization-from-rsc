import { dehydrate, QueryClient } from '@tanstack/react-query';
import { getUsersRange } from '@/lib/data';
import { firstRange, usersQueryKey, type UsersWindow } from '@/lib/users-query';

/**
 * Server only: fetches the client lists' first range into a React Query cache and
 * returns it dehydrated, for `<HydrationBoundary state={…}>`. The first rows are then
 * in the HTML and the client doesn't fetch them again.
 */
export async function prefetchFirstUsers(total: number) {
  const queryClient = new QueryClient();
  const first = firstRange(total);
  await queryClient
    .query({
      queryKey: usersQueryKey(total, first),
      queryFn: async (): Promise<UsersWindow> => ({
        start: first.start,
        items: await getUsersRange(first.start, first.end, total),
      }),
    })
    // If it fails, nothing is cached and the client list fetches the range itself.
    .catch(() => {});
  return dehydrate(queryClient);
}
