export type User = { id: number; name: string; email: string; age: number };

const FIRST = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken', 'Margaret', 'Dennis', 'Radia'];
const LAST = ['Lovelace', 'Hopper', 'Torvalds', 'Liskov', 'Thompson', 'Hamilton', 'Ritchie', 'Perlman'];

// Deterministic fake data.
function makeUser(i: number): User {
  const first = FIRST[i % 8];
  const last = LAST[(i >> 3) % 8];
  return {
    id: i,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    age: 18 + (i % 60),
  };
}

// Stands in for a paged DB query: only builds the requested rows.
export async function getUsersRange(start: number, end: number, total: number): Promise<User[]> {
  const out: User[] = [];
  for (let i = Math.max(0, start); i < Math.min(end, total); i++) out.push(makeUser(i));
  return out;
}

// Defaults to 10k: the server list sends every row with the page, which is
// fine at 10k and slow beyond ~100k (see README).
export async function getN(searchParams: Promise<{ n?: string }>) {
  const { n } = await searchParams;
  return Math.min(Math.max(Number(n) || 5000, 1), 1_000_000);
}
