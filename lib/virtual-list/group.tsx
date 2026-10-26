'use client';

import { createContext, memo, useContext, useMemo, type ComponentProps, type ReactNode } from 'react';
import { useVirtualizerContext, useVirtualizerStateContext } from './root';
import type { Range } from './types';
import { useVirtualizerGroup, useVirtualizerItems } from './use-virtualizer';

type GroupContextValue = {
  /** The group's index. */
  index: number;
  /** The group's rendered items. */
  items: Range;
} & ReturnType<typeof useVirtualizerGroup>;

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
  const state = useVirtualizerStateContext();
  const { listStyle, spacerStyle, windowProps, groups } = useVirtualizerItems(state);
  if (!state.layout.grouped) {
    throw new Error('<VirtualList.Groups> needs a grouped count: one size per group, e.g. count={[120, 335, 48]}.');
  }
  return (
    <div role="list" style={listStyle}>
      <div aria-hidden style={spacerStyle} />
      <div {...windowProps}>
        {groups.map((group) => (
          <GroupView
            key={group.index}
            index={group.index}
            itemStart={group.items.start}
            itemEnd={group.items.end}
            labelRow={group.labelRow}
            labelInRange={group.labelInRange}
          >
            {renderGroup(group.index)}
          </GroupView>
        ))}
      </div>
    </div>
  );
}

/** Gives one group its context. Memoized, so a group that stays on screen only re-renders when it changes. */
const GroupView = memo(function GroupView({
  index,
  itemStart,
  itemEnd,
  labelRow,
  labelInRange,
  children,
}: {
  index: number;
  itemStart: number;
  itemEnd: number;
  labelRow: number;
  labelInRange: boolean;
  children: ReactNode;
}) {
  const items = useMemo(() => ({ start: itemStart, end: itemEnd }), [itemStart, itemEnd]);
  const label = useVirtualizerGroup(useVirtualizerContext(), { index, items, labelRow, labelInRange });
  const value = useMemo(
    () => ({ index, items, ...label }),
    [index, items, label.labelId, label.labelRef, labelRow, labelInRange],
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
  const { labelRef, labelProps } = group;
  return (
    <div
      {...props}
      {...labelProps}
      ref={labelRef}
      // `hidden` alone loses to a class that sets `display`, so the hook's `display: none` is kept.
      style={{ ...labelProps.style, ...style, ...(labelProps.hidden ? { display: 'none' } : null) }}
    />
  );
}
