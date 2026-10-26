export type User = { id: number; name: string; email: string; age: number; bio?: string };

const FIRST = ['Ada', 'Grace', 'Linus', 'Barbara', 'Ken', 'Margaret', 'Dennis', 'Radia'];
const LAST = ['Lovelace', 'Hopper', 'Torvalds', 'Liskov', 'Thompson', 'Hamilton', 'Ritchie', 'Perlman'];

const SENTENCES = [
  'Writes compilers for fun.',
  'Maintains a popular open source scheduler and answers every issue within a day.',
  'Previously led the storage team, and still keeps a spreadsheet of every outage since 2014.',
  'Likes long walks and short functions.',
  'Has opinions about tabs, spaces, and the correct number of blank lines between imports.',
  'Currently learning Rust, slowly.',
  'Speaks at conferences about distributed systems, type theory, and occasionally sourdough.',
  'Mentors new engineers on Fridays.',
];

// A stable pseudo-random number per user, so a user always gets the same bio.
const hash = (i: number) => (Math.imul(i + 1, 2654435761) >>> 0) / 2 ** 32;

/** 0–3 sentences: about 40% of users have no bio, and some have a long one. */
function bioOf(i: number): string | undefined {
  const r = hash(i);
  const sentences = r < 0.4 ? 0 : r < 0.7 ? 1 : r < 0.9 ? 2 : 3;
  if (sentences === 0) return undefined;
  return Array.from({ length: sentences }, (_, k) => SENTENCES[Math.floor(hash(i * 7 + k) * SENTENCES.length)]).join(
    ' ',
  );
}

// Deterministic fake data.
export function makeUser(i: number): User {
  const first = FIRST[i % 8];
  const last = LAST[(i >> 3) % 8];
  return {
    id: i,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    age: 18 + (i % 60),
    bio: bioOf(i),
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

export type Team = { id: number; name: string; size: number };

/** Users split into teams of 5–120, in order, covering all `total` users. */
export function getTeams(total: number): Team[] {
  const teams: Team[] = [];
  for (let used = 0, i = 0; used < total; i++) {
    const size = Math.min(total - used, 5 + Math.floor(hash(i * 13 + 5) * 116));
    teams.push({ id: i, name: `Team ${i + 1}`, size });
    used += size;
  }
  return teams;
}
