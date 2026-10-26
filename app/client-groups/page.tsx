import { HydrationBoundary } from '@tanstack/react-query';
import { getN, getTeams } from '@/lib/data';
import { prefetchFirstUsers } from '@/lib/users-prefetch';
import { TeamList } from '../_components/team-list';
import { ReactQueryClientProvider } from '../_components/user-list';

// Grouped client list: the teams come from here; React Query loads the users by range.
export default async function Page({ searchParams }: PageProps<'/client-groups'>) {
  const total = await getN(searchParams);
  const teams = getTeams(total);
  return (
    <main>
      <h1>Client Component + groups</h1>
      <p>
        {total.toLocaleString()} users in {teams.length} teams
      </p>
      <ReactQueryClientProvider>
        <HydrationBoundary state={await prefetchFirstUsers(total)}>
          <TeamList total={total} teams={teams} />
        </HydrationBoundary>
      </ReactQueryClientProvider>
    </main>
  );
}
