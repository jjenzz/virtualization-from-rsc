import type { Range } from '#virtual-list';
import type { User } from '@/lib/data';

/** Page size of the client list. Ranges from `onRangeChange` are whole pages of it. */
export const PAGE = 50;

/** What a users query stores: the items and the index of the first, for `offset`. */
export type UsersWindow = { start: number; items: User[] };

export const usersQueryKey = (total: number, range: Range) => ['users', total, range.start, range.end] as const;

/** The list's first reported range: two pages from the top */
export const firstRange = (total: number): Range => ({ start: 0, end: Math.min(total, 2 * PAGE) });
