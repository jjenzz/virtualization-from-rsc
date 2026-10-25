import { createFromReadableStream } from '@vitejs/plugin-rsc/browser';
import type { ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { rscStream } from 'rsc-html-stream/client';

async function main() {
  const root = await createFromReadableStream<ReactNode>(rscStream);
  hydrateRoot(document, root);
}

main();
