import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { Range } from '#virtual-list';
import type { User } from '@/lib/data';

// Shared by the Server Component (which prefetches the first range) and the client
// lists, so they all use the same query key and options. Not a 'use client' file:
// values exported from one would reach Server Components as client references.

/** Page size of the client lists. Ranges from `onRangeChange` are whole pages of it. */
export const PAGE = 50;

/** What a users query stores: the items and the index of the first, for `offset`. */
export type UsersWindow = { start: number; items: User[] };

export const usersQueryKey = (total: number, range: Range) => ['users', total, range.start, range.end] as const;

/**
 * The users for a range reported by `onRangeChange`. The ranges are snapped to whole
 * pages, so they work as query keys directly, and the flat and grouped lists share
 * the cache. While a range loads, the previous one stays on screen; the result
 * carries its own `start` for the list's `offset`.
 */
export const usersQuery = (total: number, range: Range) =>
  queryOptions({
    queryKey: usersQueryKey(total, range),
    queryFn: async ({ signal }): Promise<UsersWindow> => {
      const res = await fetch(`/api/users?start=${range.start}&end=${range.end}&total=${total}`, { signal });
      return { start: range.start, items: (await res.json()) as User[] };
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  });

/** The lists' first reported range: two pages from the top. */
export const firstRange = (total: number): Range => ({ start: 0, end: Math.min(total, 2 * PAGE) });
