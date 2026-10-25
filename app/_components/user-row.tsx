import type { User } from '@/lib/data';
import { VirtualList } from '#virtual-list';

export function UserRow({ user }: { user: User }) {
  return (
    <VirtualList.Item className="row">
      <span className="name">{user.name}</span>
      <span className="email">{user.email}</span>
      <span className="age">{user.age}</span>
    </VirtualList.Item>
  );
}

export const Placeholder = () => (
  <VirtualList.Item className="row" data-pending="">
    Loading…
  </VirtualList.Item>
);
