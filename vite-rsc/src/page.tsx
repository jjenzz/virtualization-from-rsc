import { HydrationBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TeamList } from '../../app/_components/team-list';
import { ReactQueryClientProvider, UserList } from '../../app/_components/user-list';
import { getTeams, getUsersRange, type Team, type User } from '../../lib/data';
import { DEMOS } from '../../lib/demos';
import { prefetchFirstUsers } from '../../lib/users-prefetch';
import { createDataset, VirtualList } from '../../lib/virtual-list/index.server';

// The same demos as the Next app, one per path. Without a client router, the nav
// links are plain page loads.

const totalFrom = (n: string | null) => Math.min(Math.max(Number(n) || 5000, 1), 1_000_000);

function Streamed({ total }: { total: number }) {
  const users = createDataset({ getItems: ({ start, end }) => getUsersRange(start, end, total) });
  return (
    <VirtualList.Root id="users" data={users} count={total} defaultItemSize={45}>
      <VirtualList.Viewport className="viewport">
        <VirtualList.Items<User> rootId="users">
          {(user, index, status) => {
            return user ? (
              <VirtualList.Item className="row">
                <span className="id">#{user.id}</span>
                <span className="name">{user.name}</span>
                <span className="email">{user.email}</span>
                {user.bio && <span className="bio">{user.bio}</span>}
              </VirtualList.Item>
            ) : status === 'pending' ? (
              <VirtualList.Item className="row" data-pending="">
                Loading…
              </VirtualList.Item>
            ) : (
              <VirtualList.Item className="row">Couldn&apos;t load row {index}</VirtualList.Item>
            );
          }}
        </VirtualList.Items>
      </VirtualList.Viewport>
    </VirtualList.Root>
  );
}

function ServerGroups({ total }: { total: number }) {
  const teams = getTeams(total);
  const users = createDataset({ getItems: ({ start, end }) => getUsersRange(start, end, total), groups: teams });
  return (
    <VirtualList.Root id="teams" data={users} count={teams.map((t) => t.size)} defaultItemSize={45}>
      <VirtualList.Viewport className="viewport">
        <VirtualList.Groups<Team> rootId="teams">
          {(team, groupIndex) => (
            <VirtualList.Group>
              <VirtualList.GroupLabel className="group-label">
                {team.name} · {team.size} people
              </VirtualList.GroupLabel>
              <VirtualList.Items<User> rootId="teams" groupIndex={groupIndex}>
                {(user) => {
                  return user ? (
                    <VirtualList.Item className="row">
                      <span className="id">#{user.id}</span>
                      <span className="name">{user.name}</span>
                      <span className="email">{user.email}</span>
                    </VirtualList.Item>
                  ) : (
                    <VirtualList.Item className="row" data-pending="">
                      Loading…
                    </VirtualList.Item>
                  );
                }}
              </VirtualList.Items>
            </VirtualList.Group>
          )}
        </VirtualList.Groups>
      </VirtualList.Viewport>
    </VirtualList.Root>
  );
}

async function WithPrefetch({ total, children }: { total: number; children: ReactNode }) {
  return (
    <ReactQueryClientProvider>
      <HydrationBoundary state={await prefetchFirstUsers(total)}>{children}</HydrationBoundary>
    </ReactQueryClientProvider>
  );
}

const PAGES: Record<string, (total: number) => ReactNode> = {
  '/streamed': (total) => <Streamed total={total} />,
  '/client': (total) => (
    <WithPrefetch total={total}>
      <UserList total={total} />
    </WithPrefetch>
  ),
  '/server-groups': (total) => <ServerGroups total={total} />,
  '/client-groups': (total) => (
    <WithPrefetch total={total}>
      <TeamList total={total} teams={getTeams(total)} />
    </WithPrefetch>
  ),
};

export function Page({ pathname, n }: { pathname: string; n: string | null }) {
  const total = totalFrom(n);
  const demo = DEMOS.find((d) => d.href === pathname);
  return (
    <>
      <nav className="demo-nav">
        {DEMOS.map((d) => (
          <a key={d.href} href={d.href} aria-current={d.href === pathname ? 'page' : undefined}>
            {d.title}
          </a>
        ))}
      </nav>
      <main>
        {demo ? (
          <>
            <h1>{demo.title} (Vite RSC)</h1>
            <p>{total.toLocaleString()} users</p>
            {PAGES[pathname](total)}
          </>
        ) : (
          <>
            <h1>VirtualList demos (Vite RSC)</h1>
            <ul>
              {DEMOS.map((d) => (
                <li key={d.href}>
                  <a href={d.href}>{d.title}</a>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
