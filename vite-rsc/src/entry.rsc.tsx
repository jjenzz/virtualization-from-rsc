import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc';
import { getUsersRange } from '../../lib/data';
import { Page } from './page';

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // JSON for the client list (the same endpoint as the Next app's app/api/users).
  if (url.pathname === '/api/users') {
    const param = (name: string) => Number(url.searchParams.get(name));
    return Response.json(await getUsersRange(param('start'), param('end'), param('total')));
  }

  const rscStream = renderToReadableStream(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>VirtualList on Vite RSC</title>
        {/* The client list (shared with the Next app) styles itself with these classes. */}
        <style>{`
          .viewport { height: 600px; border: 1px solid #ccc; }
          .row { display: flex; flex-wrap: wrap; column-gap: 16px; align-items: center; min-height: 32px; padding: 6px 12px; border-bottom: 1px solid #eee; }
          .bio { flex-basis: 100%; margin: 2px 0 0 64px; color: #666; }
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
