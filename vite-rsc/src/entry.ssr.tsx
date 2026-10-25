import { createFromReadableStream, getClientEntryUrl } from '@vitejs/plugin-rsc/ssr';
import { use, type ReactNode } from 'react';
import { renderToReadableStream } from 'react-dom/server.edge';
import { injectRSCPayload } from 'rsc-html-stream/server';

// Renders the RSC stream to HTML, and inlines the same stream into the page so
// the browser hydrates from it instead of fetching it again (as Next does).
export async function renderHtml(rscStream: ReadableStream<Uint8Array>) {
  const [forSsr, forBrowser] = rscStream.tee();
  let payload: Promise<ReactNode> | undefined;
  function Root() {
    payload ??= createFromReadableStream<ReactNode>(forSsr);
    return use(payload);
  }
  const htmlStream = await renderToReadableStream(<Root />, {
    bootstrapModules: [getClientEntryUrl()],
  });
  return htmlStream.pipeThrough(injectRSCPayload(forBrowser));
}
