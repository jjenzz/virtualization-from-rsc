// Resolved everywhere else: client components and their server-side rendering.
import { Group, GroupLabel } from './group';
import { Groups } from './groups.client';
import { Item } from './item';
import { Items } from './items.client';
import { Root } from './root';
import { Viewport } from './viewport';

export const VirtualList = { Root, Viewport, Items, Item, Groups, Group, GroupLabel };
export { createDataset } from './dataset';
export type { Dataset, DatasetInput, DatasetOptions, GetItems } from './dataset';
export type { GroupsProps, ItemStatus, ItemsProps, Range, RenderItem } from './types';
export type { RootProps } from './root';
export {
  useVirtualizer,
  useVirtualizerGroup,
  useVirtualizerItem,
  useVirtualizerItems,
  useVirtualizerViewport,
} from './use-virtualizer';
export type { Axis, VirtualizerGroupRange, Virtualizer, VirtualizerOptions, VirtualizerState } from './use-virtualizer';
