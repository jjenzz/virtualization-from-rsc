'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { createDataset, VirtualList, type Range } from '#virtual-list';
import type { Team, User } from '@/lib/data';
import { firstRange, PAGE, usersQuery } from '@/lib/users-query';

// Client grouped list. The teams (small) come from the Server Component up front;
// the users load with React Query as ranges scroll into view. Items stay flat, in
// team order, so the grouped list loads the same ranges as the flat one.
export function TeamList({ total, teams }: { total: number; teams: Team[] }) {
  const [range, setRange] = useState<Range>(() => firstRange(total));
  const { data } = useQuery(usersQuery(total, range));
  const users = useMemo(() => createDataset({ items: data?.items ?? [], groups: teams }), [data, teams]);
  const count = useMemo(() => teams.map((team) => team.size), [teams]);

  return (
    <VirtualList.Root
      data={users}
      offset={data?.start ?? 0}
      count={count}
      defaultItemSize={45}
      rangeSize={PAGE}
      onRangeChange={setRange}
    >
      <VirtualList.Viewport className="viewport">
        <VirtualList.Groups<Team>>
          {(team) => (
            <VirtualList.Group>
              <VirtualList.GroupLabel className="group-label">
                {team.name} · {team.size} people
              </VirtualList.GroupLabel>
              <VirtualList.Items<User>>
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
