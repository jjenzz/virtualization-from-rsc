import {
  createTemporaryReferenceSet,
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc';
import { getUsersRange } from '../../lib/data';
import { Page } from './page';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // JSON for the client list (the same endpoint as the Next app's app/api/users).
  if (url.pathname === '/api/users') {
    const param = (name: string) => Number(url.searchParams.get(name));
    return Response.json(await getUsersRange(param('start'), param('end'), param('total')));
  }

  // A server function call (load-on-scroll list). Runs it and returns its result as
  // an RSC stream; the page isn't re-rendered.
  const actionId = request.headers.get('x-rsc-action');
  if (request.method === 'POST' && actionId) {
    const temporaryReferences = createTemporaryReferenceSet();
    const body = request.headers.get('content-type')?.startsWith('multipart/form-data')
      ? await request.formData()
      : await request.text();
    const args = await decodeReply(body, { temporaryReferences });
    const action = await loadServerAction(actionId);
    const result = Promise.resolve().then(() => action.apply(null, args));
    return new Response(renderToReadableStream(result, { temporaryReferences }), {
      headers: { 'content-type': 'text/x-component;charset=utf-8' },
    });
  }

  const rscStream = renderToReadableStream(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>VirtualList on Vite RSC</title>
        {/* The client list (shared with the Next app) styles itself with these classes. */}
        <style>{`
          .viewport { height: 600px; border: 1px solid #ccc; }
          .row { display: flex; gap: 16px; align-items: center; padding: 0 12px; }
          .row[data-pending] { color: #999; }
        `}</style>
      </head>
      <body>
        <Page n={url.searchParams.get('n')} />
      </body>
    </html>,
  );

  if (url.pathname.endsWith('.rsc')) {
    return new Response(rscStream, { headers: { 'content-type': 'text/x-component;charset=utf-8' } });
  }

  const ssr = await import.meta.viteRsc.loadModule<typeof import('./entry.ssr')>('ssr', 'index');
  const htmlStream = await ssr.renderHtml(rscStream);
  return new Response(htmlStream, { headers: { 'content-type': 'text/html;charset=utf-8' } });
}

if (import.meta.hot) import.meta.hot.accept();
