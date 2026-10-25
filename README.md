# virtualization-from-rsc

A proof of concept for a virtualized list with one API for Server and Client
Components. Items come from a **dataset**, and `children` renders one item.

```tsx
<VirtualList.Root data={dataset} count={total} itemSize={32}>
  <VirtualList.Viewport>
    <VirtualList.Items<User>>
      {(user, index, status) => {
        return user ? (
          <VirtualList.Item>{user.name}</VirtualList.Item>
        ) : status === 'pending' ? (
          <VirtualList.Item data-pending="">Loading…</VirtualList.Item>
        ) : status === 'error' ? (
          <VirtualList.Item data-error="">Couldn&apos;t load row {index}</VirtualList.Item>
        ) : null;
      }}
    </VirtualList.Items>
  </VirtualList.Viewport>
</VirtualList.Root>
```

`user` is defined exactly when the row loaded, so checking `user` narrows it. `status`
tells the other cases apart.

`data` is either a source the server reads while rendering, or the items being
rendered:

```tsx
<VirtualList.Root data={createDataset({ getItems })}> // server
<VirtualList.Root data={users} offset={first}>         // client: users[0] is item `first`
```

Run `pnpm dev` and open `/` (`?n=…` sets the item count, default 5k). The page shows
both lists below.

## One import, two builds

A function can't be passed from a Server Component to a Client Component, so a
render prop like `children` normally can't cross the boundary. The list gets around
this by shipping two builds of `Items` behind one import:

- **Server build:** `Items` is a Server Component. It calls `children` on the server
  and sends the rendered rows to the browser, so the function itself never crosses.
- **Client build:** `Items` is a Client Component, and calls `children` in the browser.

`#virtual-list` picks the build with the
[`react-server` condition](https://github.com/reactjs/rfcs/blob/main/text/0227-server-module-conventions.md)
in `package.json` `"imports"`. Server Components get the server build and everything
else gets the client build. As a package, this would be the same map under `"exports"`.

```json
"#virtual-list": {
  "react-server": "./lib/virtual-list/index.server.ts",
  "default": "./lib/virtual-list/index.client.ts"
}
```

## Modes

| Where            | Dataset    | `children` | Rows are…                              |
| ---------------- | ---------- | ---------- | -------------------------------------- |
| Server Component | `getItems` | a function | streamed in the page's response        |
| Client Component | `items`    | a function | rendered from data the app passes down |

### Server Component: streamed

```tsx
const users = createDataset({
  getItems: ({ start, end }) => getUsersRange(start, end, total),
});

<VirtualList.Root id="users" data={users} count={total} itemSize={32}>
  <VirtualList.Viewport>
    <VirtualList.Items<User> rootId="users">
      {(user, index, status) => …}
    </VirtualList.Items>
  </VirtualList.Viewport>
</VirtualList.Root>;
```

- The first 50 rows are in the first chunk of HTML. The rest stream in the same
  response, so nothing is requested after the page loads.
- Every row is sent, so this suits lists up to roughly 10k–100k items. For larger
  lists, use a Client Component that loads ranges as you scroll (below), with the
  first range prefetched on the server.

### Client Component

```tsx
'use client';

const [range, setRange] = useState({ start: 0, end: 100 });
const users = useUsers(range); // your data loading; returns the items for `range`

<VirtualList.Root data={users} offset={range.start} count={total} itemSize={32} onRangeChange={setRange}>
  <VirtualList.Viewport>
    <VirtualList.Items<User>>
      {(user) => {
        return user ? (
          <VirtualList.Item>{user.name}</VirtualList.Item>
        ) : (
          <VirtualList.Item data-pending="">Loading…</VirtualList.Item>
        );
      }}
    </VirtualList.Items>
  </VirtualList.Viewport>
</VirtualList.Root>;
```

- Data down, actions up: the list reports the range to load, and the app passes back
  only the items being rendered, with `offset` as the first one's index. The list never
  fetches, so caching stays with your data library.
- The reported range is snapped to whole pages (`rangeSize`), so the same rows always
  give the same range, which makes it a good cache key.

The demo loads ranges with React Query: see [user-list.tsx](app/_components/user-list.tsx).

## API

**`Root`** takes:

- `data`: anything `createDataset` takes: options, an items array, or a dataset.
- `offset`: the index of the first item in `data`. Defaults to 0.
- `count`, `overscan`.
- `itemSize` for rows of one fixed height, or `defaultItemSize` for rows of different
  heights. Measured rows size themselves; unmeasured rows count as the estimate.
- `rangeSize`: the page size for reported ranges. At least the number of visible rows.
  Defaults to 50.
- `onRangeChange` (client only): called with the `{ start, end }` to load.
- `id`: the root element's id. In a Server Component, other parts link to `Root`
  with it (`rootId`), described below.

**`Items`** takes `children(item, index, status)`, which renders one row:

- `status` is `"loaded"`, `"pending"`, `"missing"` or `"error"`. `item` is defined
  only when loaded, so check `item` to narrow it.
- Pass the item type on the tag: `<VirtualList.Items<User>>`.
- No `key` needed, and no hooks in `children` itself. On the server it may be async.

**`rootId`:** Server Components have no context, so in a Server Component `Root`
takes an `id` and the other parts pass it as `rootId`, like `<input list>` pointing at
a `<datalist id>`. The id is unique within the page. `Root` registers its dataset under
it in a per-request `React.cache()` map, and `Items` looks it up.

## Pending and failed rows

In the streamed server list:

| What happens                            | What the row shows                                               |
| --------------------------------------- | ---------------------------------------------------------------- |
| Not loaded yet                          | `children(undefined, -1, 'pending')`                             |
| `getItems` throws                       | `children(undefined, index, 'error')` for each row in that range |
| `getItems` returns no item for an index | `children(undefined, index, 'missing')`                          |
| `children` throws for a row             | nothing (the error is logged)                                    |
| The stream fails                        | `children(undefined, -1, 'error')`                               |

- The two rows rendered with index -1 are rendered once and reused for every row.

## Variable heights

With `defaultItemSize`, rows are measured as they render, and only measured rows are
stored, so memory grows with the rows you've seen, not with `count`. Unmeasured rows
count as the average measured height (or `defaultItemSize` before any are measured).

Rows sit in normal flow under a spacer as tall as everything above them. When a row
above the viewport changes height, the list moves the scroll position by the same
amount, so the view stays still. While the scrollbar is dragged, new measurements wait
until it's released, so the thumb doesn't drift from the pointer. Don't give rows
vertical margins; they aren't measured.

## Files

| File                                      | Build  | Does                                                           |
| ----------------------------------------- | ------ | -------------------------------------------------------------- |
| `root.tsx`, `viewport.tsx`, `item.tsx`    | both   | Shared client parts: visible range, scrolling, measuring rows. |
| `sizes.ts`                                | both   | Row heights and positions, stored sparsely.                    |
| `items.tsx`, `dataset.ts`, `types.ts`     | both   | List element, `createDataset`, types.                          |
| `items.client.tsx`                        | client | Renders visible rows from `items`.                             |
| `root.server.tsx`, `list-store.server.ts` | server | Registers `Root`'s dataset under its `id`.                     |
| `items.server.tsx`                        | server | Picks the mode, renders the first rows, streams the rest.      |
| `render-rows.server.ts`                   | server | Fetching and row rendering for the stream.                     |
| `items-stream.tsx`                        | server | Client half: places streamed rows by index.                    |

## How streaming works

- Rows are fetched in pages of 1,000. Up to 4 `getItems` calls run ahead, but pages
  are rendered and sent in order.
- Each page is sent as slices. The list times each slice and sizes the next one to
  take about 10 ms, waiting a turn of the event loop between slices so the framework
  can send what's ready. That's a few dozen rows per slice in Next dev and a whole page
  in production, without any per-framework settings.
- Each slice is a promise passed to the client half, which writes the rows at their
  indices as they arrive.

## Vite

[`vite-rsc/`](vite-rsc) renders the same two lists with `@vitejs/plugin-rsc`, using
`lib/virtual-list` and the client list unchanged. Its RSC entry also serves
`/api/users` for the client list:

```sh
cd vite-rsc && pnpm install && pnpm dev   # or: pnpm build && pnpm preview
```
