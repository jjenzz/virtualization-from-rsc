'use client';

import { useQuery } from '@tanstack/react-query';
import { memo, useState } from 'react';
import {
  useVirtualizer,
  useVirtualizerItem,
  useVirtualizerItems,
  useVirtualizerViewport,
  type Range,
  type Virtualizer,
} from '#virtual-list';
import type { User } from '@/lib/data';
import { firstRange, PAGE, usersQuery } from '@/lib/users-query';

const ROW_HEIGHT = 36;
const COLUMN_WIDTH = 160;

type Column = { title: string; value: (user: User) => string | number };

/** A few real fields, then made-up numbers, to make the table wide. */
const COLUMNS: Column[] = [
  { title: 'Name', value: (user) => user.name },
  { title: 'Email', value: (user) => user.email },
  { title: 'Age', value: (user) => user.age },
  ...Array.from({ length: 47 }, (_, k): Column => ({
    title: `Metric ${k + 1}`,
    value: (user) => (Math.imul(user.id + 1, 2654435761 + k * 97) >>> 0) % 1000,
  })),
];

/**
 * A table on the headless hooks: one list for rows (y) and one for columns (x),
 * sharing one viewport. Rows load with React Query, like the client list.
 */
export function UserTable({ total }: { total: number }) {
  const [range, setRange] = useState<Range>(() => firstRange(total));
  const { data } = useQuery(usersQuery(total, range));
  const userAt = (index: number) => (data ? data.items[index - data.start] : undefined);

  const rows = useVirtualizer({ count: total, itemSize: ROW_HEIGHT, rangeSize: PAGE, onRangeChange: setRange });
  const columns = useVirtualizer({ count: COLUMNS.length, itemSize: COLUMN_WIDTH, axis: 'x' });
  const viewport = useVirtualizerViewport([rows.virtualizer, columns.virtualizer]);
  const rowItems = useVirtualizerItems(rows.state);
  const columnItems = useVirtualizerItems(columns.state);

  return (
    <div
      ref={viewport.ref}
      {...viewport.props}
      className="viewport table"
      role="table"
      aria-label="Users"
      aria-rowcount={total + 1}
      aria-colcount={COLUMNS.length}
    >
      {/* The header is in flow above the rows, so it takes up the top of the viewport and the rows below it line up with the scroll position. */}
      <div role="rowgroup" style={{ ...columnItems.listStyle, height: rows.state.listSize + ROW_HEIGHT }}>
        <div role="row" aria-rowindex={1} className="table-row table-header">
          <div aria-hidden style={columnItems.spacerStyle} />
          <div {...columnItems.windowProps} className="table-cells">
            {columnItems.indexes.map((column) => (
              <Cell key={column} columns={columns.virtualizer} column={column} header>
                {COLUMNS[column].title}
              </Cell>
            ))}
          </div>
        </div>
        <div aria-hidden style={rowItems.spacerStyle} />
        <div {...rowItems.windowProps}>
          {rowItems.indexes.map((index) => (
            <Row
              key={index}
              rows={rows.virtualizer}
              columns={columns.virtualizer}
              index={index}
              user={userAt(index)}
              columnRange={columns.state.range.items}
              columnSpacer={columnItems.spacerStyle}
              columnWindow={columnItems.windowProps}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const Row = memo(function Row({
  rows,
  columns,
  index,
  user,
  columnRange,
  columnSpacer,
  columnWindow,
}: {
  rows: Virtualizer;
  columns: Virtualizer;
  index: number;
  user: User | undefined;
  columnRange: Range;
  columnSpacer: React.CSSProperties;
  /** Holds the row's rendered cells: sticky, like the rows' window, for fast sideways scrolls. */
  columnWindow: React.ComponentProps<'div'>;
}) {
  const row = useVirtualizerItem(rows, { index, row: index, pending: !user });
  const cells = [];
  for (let column = columnRange.start; column < columnRange.end; column++) {
    cells.push(
      <Cell key={column} columns={columns} column={column}>
        {user ? COLUMNS[column].value(user) : '…'}
      </Cell>,
    );
  }
  return (
    // The header is row 1, so data rows start at 2.
    <div
      ref={row.ref}
      {...row.props}
      role="row"
      aria-rowindex={index + 2}
      className="table-row"
      data-pending={user ? undefined : ''}
    >
      <div aria-hidden style={columnSpacer} />
      <div {...columnWindow} className="table-cells">
        {cells}
      </div>
    </div>
  );
});

function Cell({
  columns,
  column,
  header = false,
  children,
}: {
  columns: Virtualizer;
  column: number;
  header?: boolean;
  children: React.ReactNode;
}) {
  const cell = useVirtualizerItem(columns, { index: column, row: column });
  return (
    <div
      ref={cell.ref}
      {...cell.props}
      role={header ? 'columnheader' : 'cell'}
      aria-colindex={column + 1}
      className="table-cell"
    >
      {children}
    </div>
  );
}
