// Resolved everywhere else: client components and their server-side rendering.
import { Item } from './item';
import { Items } from './items.client';
import { Root } from './root';
import { Viewport } from './viewport';

export const VirtualList = { Root, Viewport, Items, Item };
export { createDataset } from './dataset';
export type { Dataset, DatasetOptions, QueryFn } from './dataset';
export type { ItemStatus, ItemsProps, Range, RenderItem } from './types';
export type { RootProps } from './root';
