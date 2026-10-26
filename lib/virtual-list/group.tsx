'use client';

import {
  createContext,
  memo,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useListHeight, useRangeContext, useRootContext, useSizesContext } from './root';
import { indicesOf, type Range } from './types';

type GroupContextValue = {
  /** The group's index. */
  index: number;
  /** The group's items. */
  items: Range;
  /** The row of the group's label. */
  labelRow: number;
  /** Whether the label's row is rendered; otherwise it stays mounted, hidden, for `aria-labelledby`. */
  labelInRange: boolean;
  /** The label's element id, for the group's `aria-labelledby`. */
  labelId: string;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function useGroupContext() {
  return useContext(GroupContext);
}

/**
 * The list element of a grouped list, with the groups that have rendered rows
 * inside, under a spacer as tall as everything above them. Shared by both builds:
 * `renderGroup(index)` returns a group's content (`Group` with its label and items).
 */
export function GroupsFrame({ renderGroup }: { renderGroup: (index: number) => ReactNode }) {
  const { layout } = useRootContext();
  const sizes = useSizesContext();
  const listHeight = useListHeight();
  const range = useRangeContext();
  if (!layout.grouped) {
    throw new Error('<VirtualList.Groups> needs a grouped count: one size per group, e.g. count={[120, 335, 48]}.');
  }
  return (
    <div role="list" style={{ height: listHeight }}>
      <div aria-hidden style={{ height: sizes.start(range.rows.start) }} />
      {indicesOf(layout.groupsInRows(range.rows)).map((index) => {
        const labelRow = layout.labelRow(index);
        return (
          <GroupView
            key={index}
            index={index}
            items={layout.groupItems(index)}
            labelRow={labelRow}
            labelInRange={labelRow >= range.rows.start && labelRow < range.rows.end}
          >
            {renderGroup(index)}
          </GroupView>
        );
      })}
    </div>
  );
}

/** Gives one group its context. Memoized, so a group that stays on screen only re-renders when it changes. */
const GroupView = memo(function GroupView({
  index,
  items,
  labelRow,
  labelInRange,
  children,
}: Omit<GroupContextValue, 'labelId'> & { children: ReactNode }) {
  const labelId = useId();
  const value = useMemo(
    () => ({ index, items, labelRow, labelInRange, labelId }),
    // `items` is a new object each render; its bounds are what matter.
    [index, items.start, items.end, labelRow, labelInRange, labelId],
  );
  return <GroupContext value={value}>{children}</GroupContext>;
});

/**
 * One group: a `role="group"` element labelled by its `GroupLabel`. It contains
 * only the group's rendered rows, so style the label and the items rather than it.
 */
export function Group(props: ComponentProps<'div'>) {
  const group = useGroupContext();
  if (!group) throw new Error('<VirtualList.Group> must be rendered by <VirtualList.Groups>.');
  return <div role="group" aria-labelledby={group.labelId} {...props} />;
}

/**
 * The group's label, a row of its own: measured and positioned like an item. When
 * it has scrolled out of the rendered rows while some of its items are still
 * rendered, it stays mounted but hidden, so the group's label still resolves.
 */
export function GroupLabel({ style, ...props }: ComponentProps<'div'>) {
  const group = useGroupContext();
  if (!group) throw new Error('<VirtualList.GroupLabel> must be rendered inside <VirtualList.Group>.');
  const { itemSize, onRowMount } = useRootContext();
  const ref = useRef<HTMLDivElement>(null);
  const { labelRow, labelInRange } = group;

  useLayoutEffect(() => {
    if (itemSize !== undefined || !labelInRange) return;
    // Labels don't feed the average item height.
    return onRowMount(ref.current!, labelRow, false);
  }, [itemSize, labelRow, labelInRange, onRowMount]);

  return (
    <div
      id={group.labelId}
      data-row-index={labelRow}
      aria-hidden="true"
      hidden={!labelInRange}
      {...props}
      ref={ref}
      // `hidden` alone loses to a class that sets `display`, so it's enforced inline.
      style={{ height: itemSize, ...style, ...(labelInRange ? null : { display: 'none' }) }}
    />
  );
}
