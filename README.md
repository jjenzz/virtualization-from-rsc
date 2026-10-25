# virtualization-from-rsc

A proof of concept for a virtualized list with one API for Server and Client
Components. Items come from a **dataset**; `children` renders one item.

```tsx
<VirtualList.Root itemSize={32}>
  <VirtualList.Viewport>
    <VirtualList.Items data={dataset}>
      {(user) => (
        <VirtualList.Item key={user.id}>
          <span className="name">{user.name}</span>
          <span className="email">{user.email}</span>
          <span className="age">{user.age}</span>
        </VirtualList.Item>
      )}
    </VirtualList.Items>
  </VirtualList.Viewport>
</VirtualList.Root>
```

A dataset describes data; it doesn't load anything by itself. On the server, the
list calls a dataset's `queryFn` while it streams (your function does the fetching; the
list decides which ranges and when). On the client, the list never calls `queryFn` or
fetches; it renders `items` and reports the visible range:

```ts
createDataset({ count, rangeSize, queryFn }); // server: read batches while streaming
createDataset({ count, rangeSize, items }); // data you have, by range number (client or server)
```

Run with `pnpm dev` and open `/` (add `?n=…` to change the item count; default 10k).
Both demos are on that page.

## Server Component

```tsx
const users = createDataset({
  queryFn: ({ start, end }) => getUsersRange(start, end),
  count: total,
  rangeSize: 50,
});

<VirtualList.Items data={users}>
  {(user) => (
    <VirtualList.Item key={user.id}>
      <span className="name">{user.name}</span>
      <span className="email">{user.email}</span>
      <span className="age">{user.age}</span>
    </VirtualList.Item>
  )}
</VirtualList.Items>;
```

- The first page is loaded, rendered and sent in the first chunk of HTML.
- Every later page is loaded and rendered on a later tick and streamed **in the
  same response**. Nothing is requested after the page arrives.
- `children` runs only on the server, once per item, as `(item, index, status)`:
  `"loaded"`, `"missing"` (`queryFn` returned no item for that index) or `"error"`
  (`queryFn` threw for that chunk; render `null`, a message or a retry button).
- Every row is sent, so this suits lists up to ~10k items. Rows past the first page
  are blank until their part of the stream arrives.

## Client Component (React Query)

```tsx
'use client';

const [range, setRange] = useState({ start: 0, end: PAGE });
const pageNumbers = pagesIn(range);
const results = useQueries({
  queries: pageNumbers.map((p) => ({
    queryKey: ['users', p],
    queryFn: ({ signal }) => fetchUsers(p * PAGE, (p + 1) * PAGE, signal),
    initialData: p === 0 ? initialPage : undefined, // page 0 fetched by the Server Component
    staleTime: Infinity,
  })),
});
const users = createDataset({
  count: total,
  rangeSize: PAGE,
  items: Object.fromEntries(pageNumbers.map((p, i) => [p, results[i].data])),
});

<VirtualList.Items data={users} onRangeChange={setRange}>
  {(user) => {
    return user ? (
      <VirtualList.Item key={user.id}>
        <span className="name">{user.name}</span>
        <span className="email">{user.email}</span>
        <span className="age">{user.age}</span>
      </VirtualList.Item>
    ) : (
      <Placeholder />
    );
  }}
</VirtualList.Items>;
```

- Data down, actions up: the list reports the visible `{ start, end }`, the app
  turns it into queries, and the results come back as a dataset.
- React Query handles dedupe, caching, retries and cancelling pages that scroll
  away before they load. The dataset only holds the visible pages.
- `onRangeChange` gives `start`/`end` rather than page numbers, so the app can map
  the range onto whatever it loads (pages, cursors, infinite loading).
- Items not loaded yet have status `"pending"` (and are `undefined`), so
  `children` renders its own placeholder.
- The Server Component fetches page 0 and passes it in as `initialData`, so this
  list's first page is in the HTML too.

See [app/page.tsx](app/page.tsx) and [app/_components/user-list.tsx](app/_components/user-list.tsx).

## One import, two builds

`#virtual-list` is mapped in `package.json` `"imports"` with the
[`react-server` condition](https://github.com/reactjs/rfcs/blob/main/text/0227-server-module-conventions.md):

```json
"#virtual-list": {
  "react-server": "./lib/virtual-list/index.server.ts",
  "default": "./lib/virtual-list/index.client.ts"
}
```

Server Components get the server build; client components (and their SSR) get
the client build. As a published package this would be the same map under
`"exports"`. Only `Items` differs between the builds:

| File                                   | Build  | Does                                                                                       |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `root.tsx`, `viewport.tsx`, `item.tsx` | both   | Shared parts (all `'use client'`).                                                         |
| `dataset.ts`                           | both   | `createDataset`, `itemAt`.                                                                 |
| `items-frame.tsx`, `types.ts`          | both   | Full-height list element: visible range, `onRangeChange`, item positions. Shared types.    |
| `items.server.tsx`                     | server | Renders the first `rangeSize` items, then streams the rest in chunks of 1,000 as promises. |
| `items-stream.tsx`                     | server | Client half: appends each streamed chunk as it arrives.                                    |
| `items.client.tsx`                     | client | Renders visible items from the dataset; passes `onRangeChange` through.                    |
| `index.server.ts` / `index.client.ts`  | —      | Entry points; build `VirtualList` with their build's `Items`.                              |

## Rules

- `children` renders one item. Don't call hooks in it; put them in the row
  components it returns.
- `children(item, index, status)` is synchronous in both builds. `item` is defined
  when `status` is `"loaded"`; the type doesn't narrow (that would force every
  consumer to declare all three parameters), so check `item` too.
- A dataset has either `items` or `queryFn`, never both. The server list calls `queryFn`
  while streaming; the client list never calls it (the app can, e.g. from `onRangeChange`).

## How the server build streams

- The first `rangeSize` items are awaited, so they're in the first HTML chunk.
- The rest go out in chunks of 1,000, each passed to the client half as a promise;
  React keeps the response open and appends each one as it resolves.
- Every chunk's promise is created up front, so none is chained to another.
  Chaining them made React's dev build very slow and overflowed the stack at ~1M items.
- Each chunk starts on a later tick (`setImmediate`). Starting them straight away
  loaded, built and serialized every row before the first HTML was sent: the first
  byte took 1–1.5 s at 100k items.
- If `queryFn` throws for a chunk, that chunk's items render with status `"error"` and
  the rest of the list carries on. If `children` itself throws, that chunk's rows are
  left empty and logged. Either way every chunk has one row per index, so later rows
  keep their positions.
- The client half appends rows to one array and re-renders, rather than using
  `use()` + Suspense, which would delay rows by ~300 ms (React's Suspense reveal throttle).
