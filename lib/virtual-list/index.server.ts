// Resolved for Server Components via the "react-server" condition (see package.json "imports").
import { Item } from './item';
import { Items } from './items.server';
import { Root } from './root';
import { Viewport } from './viewport';

export const VirtualList = { Root, Viewport, Items, Item };
export { createDataset } from './dataset';
export type { Dataset, DatasetOptions, QueryFn } from './dataset';
export type { ItemStatus, ItemsProps, Range, RenderItem } from './types';
export type { RootProps } from './root';
