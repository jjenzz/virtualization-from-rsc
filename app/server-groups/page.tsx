import { createDataset, VirtualList } from '#virtual-list';
import { getN, getTeams, getUsersRange, type Team, type User } from '@/lib/data';

// Grouped server list: users split into teams. Items stay flat (in team order); the
// teams go in the dataset, and their sizes on Root's count.
export default async function Page({ searchParams }: PageProps<'/server-groups'>) {
  const total = await getN(searchParams);
  const teams = getTeams(total);
  const users = createDataset({
    getItems: ({ start, end }) => getUsersRange(start, end, total),
    groups: teams,
  });

  return (
    <main>
      <h1>Server Component + groups</h1>
      <p>
        {total.toLocaleString()} users in {teams.length} teams
      </p>
      <VirtualList.Root id="teams" data={users} count={teams.map((t) => t.size)} defaultItemSize={45}>
        <VirtualList.Viewport className="viewport">
          <VirtualList.Groups<Team> rootId="teams">
            {(team, groupIndex) => (
              <VirtualList.Group>
                <VirtualList.GroupLabel className="group-label">
                  {team.name} · {team.size} people
                </VirtualList.GroupLabel>
                <VirtualList.Items<User> rootId="teams" groupIndex={groupIndex}>
                  {(user, index, status) => {
                    return user ? (
                      <VirtualList.Item className="row">
                        <span className="id">#{user.id}</span>
                        <span className="name">{user.name}</span>
                        <span className="email">{user.email}</span>
                      </VirtualList.Item>
                    ) : status === 'pending' ? (
                      <VirtualList.Item className="row" data-pending="">
                        Loading…
                      </VirtualList.Item>
                    ) : (
                      <VirtualList.Item className="row" data-error="">
                        Couldn&apos;t load row {index}
                      </VirtualList.Item>
                    );
                  }}
                </VirtualList.Items>
              </VirtualList.Group>
            )}
          </VirtualList.Groups>
        </VirtualList.Viewport>
      </VirtualList.Root>
    </main>
  );
}
