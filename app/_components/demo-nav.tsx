'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEMOS } from '@/lib/demos';

export function DemoNav() {
  const pathname = usePathname();
  return (
    <nav className="demo-nav">
      {DEMOS.map((demo) => (
        <Link key={demo.href} href={demo.href} aria-current={pathname === demo.href ? 'page' : undefined}>
          {demo.title}
        </Link>
      ))}
    </nav>
  );
}
