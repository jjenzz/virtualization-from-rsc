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

Run `pnpm dev` and open `/`. Each demo has its own route, linked from the nav
(`?n=…` sets the item count, default 5k):

| Route            | Demo                                                      |
| ---------------- | --------------------------------------------------------- |
| `/streamed`      | [Server Component + stream rows](app/streamed/page.tsx)   |
| `/client`        | [Client Component + fetch on scroll](app/client/page.tsx) |
| `/server-groups` | [Server Component + groups](app/server-groups/page.tsx)   |
| `/client-groups` | [Client Component + groups](app/client-groups/page.tsx)   |
| `/table`         | [Client Component + table (hooks)](app/table/page.tsx)    |

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
const users = loadUsers(range); // however your app loads data; the items for `range`

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
- While the scrollbar is dragged, a range is reported once the thumb settles in it
  (120 ms), at least every 400 ms, and on release, so a fast drag doesn't request every
  range it crosses. Pass your data library's abort signal to `fetch` so requests for
  ranges already scrolled past are cancelled (React Query does this).
- Placeholder rows and group labels don't feed the average row height, so a stretch of
  "Loading…" rows doesn't shrink the scrollbar.

The demo loads ranges with React Query: see [user-list.tsx](app/_components/user-list.tsx).

## API

**`Root`** takes:

- `data`: anything `createDataset` takes: options, an items array, or a dataset.
- `offset`: the index of the first item in `data`. Defaults to 0.
- `count`: how many items, or for a grouped list one number per group. Optional for a
  complete items array.
- `overscan`.
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
takes an `id` and parts that read its data pass it as `rootId`, like `<input list>`
pointing at a `<datalist id>`. Those are the parts with a render function, `Items` and
`Groups`; `Viewport`, `Item`, `Group` and `GroupLabel` don't need it. The id is unique
within the page. `Root` registers its dataset under it in a per-request `React.cache()`
map, and `Items` and `Groups` look it up.

## Groups

Groups are parts in the tree. The dataset carries your group objects (any shape), items
stay flat in group order, and `count` has one size per group:

```tsx
const produce = createDataset({ getItems, groups: categories }); // or { items, groups }
// Nested data? Flatten it: items = categories.flatMap((c) => c.products), count = their lengths.

<VirtualList.Root id="produce" data={produce} count={categories.map((c) => c.size)} defaultItemSize={32}>
  <VirtualList.Viewport>
    <VirtualList.Groups<Category> rootId="produce">
      {(category, groupIndex) => (
        <VirtualList.Group>
          <VirtualList.GroupLabel>{category.name}</VirtualList.GroupLabel>
          <VirtualList.Items<Product> rootId="produce" groupIndex={groupIndex}>
            {(product) => …}
          </VirtualList.Items>
        </VirtualList.Group>
      )}
    </VirtualList.Groups>
  </VirtualList.Viewport>
</VirtualList.Root>;
```

- `Group` is a `role="group"` element labelled by its `GroupLabel`, and holds only the
  group's rendered rows. A label is a row of its own, measured like an item; when it
  scrolls out while its group is still on screen, it stays mounted but hidden, so the
  group's label still resolves.
- Item indexes count items only, across all groups, so `offset`, `onRangeChange` and
  `aria-posinset` mean the same as in a flat list.
- So a client grouped list loads items by range exactly like a flat one: only the groups
  (small) are needed up front. See [team-list.tsx](app/_components/team-list.tsx).
- In a Server Component, `Groups` calls its function for every group, and each group's
  `Items` streams that group's items. `groupIndex` tells it which group, since Server
  Components can't read the enclosing `Group`; client components get it from context.

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
amount, so the view stays still. While the scrollbar is dragged, the total height stays
put until it's released, so the thumb doesn't drift from the pointer. Don't give rows
vertical margins; they aren't measured.

## Fast scrolling

A trackpad or wheel scroll moves the content before the next rows can render. The
rendered rows sit in a sticky window whose `top` and `bottom` are
`viewport height - window height` (negative). In normal scrolling it stays where its
rows belong. When a scroll outruns it, it's held at the viewport's edge, showing the
rows it has instead of blank space until the new ones render. The browser does this
itself while scrolling, with no script running per frame.

## Hooks

The parts are built on headless hooks, exported from the client build for custom
markup (a table, a grid). They return refs, props and positions, with no roles or
ARIA: the markup maps an index to `aria-posinset`, `aria-rowindex` or whatever it needs.

| Hook                                      | Returns                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `useVirtualizer(options)`                 | `{ virtualizer, state }`: stable settings and callbacks, and the rendered range. |
| `useVirtualizerViewport(virtualizer)`     | `{ ref, props }` for the scroll container. Takes several virtualizers too.       |
| `useVirtualizerItems(state)`              | The list, spacer and sticky window props, the rendered indexes, and the groups.  |
| `useVirtualizerItem(virtualizer, item)`   | `{ ref, props }` for one item: measures it and marks its row.                    |
| `useVirtualizerGroup(virtualizer, group)` | `{ labelId, labelRef, labelProps }` for a group's label.                         |

`useVirtualizer` takes the same options as `Root` (`count`, `itemSize` /
`defaultItemSize`, `overscan`, `rangeSize`, `onRangeChange`) plus `axis: 'y' | 'x'`.
With `axis: 'x'` it virtualizes columns, so a table can use one list for rows and
one for columns over a single viewport:

```tsx
const rows = useVirtualizer({ count: rowCount, defaultItemSize: 40 });
const columns = useVirtualizer({ count: columnCount, itemSize: 160, axis: 'x' });
const viewport = useVirtualizerViewport([rows.virtualizer, columns.virtualizer]);
```

The `/table` demo ([user-table.tsx](app/_components/user-table.tsx)) is a full example: a sticky
header, rows loaded with React Query, and `aria-rowindex` / `aria-colindex` on the cells.

## Files

| File                                      | Build  | Does                                                                      |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `use-virtualizer.ts`                      | client | The hooks: visible range, scrolling, measuring rows, either axis.         |
| `root.tsx`, `viewport.tsx`, `item.tsx`    | both   | Shared client parts, built on the hooks.                                  |
| `sizes.ts`                                | both   | Row heights and positions, stored sparsely.                               |
| `items.tsx`, `dataset.ts`, `types.ts`     | both   | List element, `createDataset`, types.                                     |
| `layout.ts`                               | both   | Maps items to rows (group labels are rows too).                           |
| `group.tsx`                               | both   | `Group`, `GroupLabel`, and the grouped list element.                      |
| `groups.client.tsx` / `groups.server.tsx` | each   | `Groups` for each build; `groups-stream.tsx` is the server's client half. |
| `items.client.tsx`                        | client | Renders visible rows from `items`.                                        |
| `root.server.tsx`, `list-store.server.ts` | server | Registers `Root`'s dataset under its `id`.                                |
| `items.server.tsx`                        | server | Renders the first rows, streams the rest (a group's, with `groupIndex`).  |
| `render-rows.server.ts`                   | server | Fetching and row rendering for the stream.                                |
| `items-stream.tsx`                        | server | Client half: places streamed rows by index.                               |

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

[`vite-rsc/`](vite-rsc) renders the same four demos, on the same routes, with `@vitejs/plugin-rsc`, using
`lib/virtual-list` and the client list unchanged. Its RSC entry also serves
`/api/users` for the client list:

```sh
cd vite-rsc && pnpm install && pnpm dev   # or: pnpm build && pnpm preview
```
