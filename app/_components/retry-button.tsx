'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/** Re-renders the page on the server, which streams the list again. */
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? 'Retrying…' : 'Retry'}
    </button>
  );
}
