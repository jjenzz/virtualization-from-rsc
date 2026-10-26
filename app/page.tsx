import Link from 'next/link';
import { DEMOS } from '@/lib/demos';

export default function Page() {
  return (
    <main>
      <h1>VirtualList demos</h1>
      <p>
        Each demo renders 5,000 users; add <code>?n=…</code> to change the count.
      </p>
      <ul>
        {DEMOS.map((demo) => (
          <li key={demo.href}>
            <Link href={demo.href}>{demo.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
