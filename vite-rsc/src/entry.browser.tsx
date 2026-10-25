import {
  createFromFetch,
  createFromReadableStream,
  createTemporaryReferenceSet,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser';
import type { ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { rscStream } from 'rsc-html-stream/client';

// Server function calls (the load-on-scroll list) go to the RSC entry as a POST,
// and their result comes back as an RSC stream.
setServerCallback(async (id, args) => {
  const temporaryReferences = createTemporaryReferenceSet();
  const response = fetch(window.location.pathname, {
    method: 'POST',
    headers: { 'x-rsc-action': id },
    body: await encodeReply(args, { temporaryReferences }),
  });
  return createFromFetch(response, { temporaryReferences });
});

async function main() {
  const root = await createFromReadableStream<ReactNode>(rscStream);
  hydrateRoot(document, root);
}

main();
