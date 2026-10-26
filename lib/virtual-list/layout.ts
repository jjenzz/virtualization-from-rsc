import type { Range } from './types';

/**
 * Maps between item indexes and rows. A flat list has one row per item. A grouped
 * list (`count` is one size per group) has, for each group, a label row followed
 * by the group's item rows. Sizes and scrolling work in rows; everything public
 * (`onRangeChange`, `offset`, `aria-posinset`) uses item indexes, which count
 * items only, across all groups.
 */
export class Layout {
  /** Total items, across all groups. */
  readonly itemCount: number;
  /** Total rows: items plus one label per group. */
  readonly rowCount: number;
  /** Number of groups, or 0 for a flat list. */
  readonly groupCount: number;
  /** `itemStarts[g]` is the first item index of group `g`; the last entry is `itemCount`. */
  private readonly itemStarts: number[];

  constructor(count: number | readonly number[]) {
    if (typeof count === 'number') {
      this.itemCount = count;
      this.rowCount = count;
      this.groupCount = 0;
      this.itemStarts = [0, count];
      return;
    }
    this.itemStarts = [0];
    for (const size of count) this.itemStarts.push(this.itemStarts[this.itemStarts.length - 1] + size);
    this.groupCount = count.length;
    this.itemCount = this.itemStarts[this.groupCount];
    this.rowCount = this.itemCount + this.groupCount;
  }

  get grouped(): boolean {
    return this.groupCount > 0;
  }

  /** The items of group `g`. */
  groupItems(g: number): Range {
    return { start: this.itemStarts[g], end: this.itemStarts[g + 1] };
  }

  /** The row of group `g`'s label. */
  labelRow(g: number): number {
    return this.itemStarts[g] + g;
  }

  /** The row item `index` is on. */
  rowOfItem(index: number): number {
    return this.grouped ? index + this.groupOfItem(index) + 1 : index;
  }

  /** The group item `index` belongs to. */
  groupOfItem(index: number): number {
    // Last group whose items start at or before `index` and that isn't empty there.
    let low = 0;
    let high = this.groupCount - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.itemStarts[mid] <= index) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  /** The group row `row` belongs to (its label or one of its items). */
  groupOfRow(row: number): number {
    let low = 0;
    let high = this.groupCount - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.labelRow(mid) <= row) low = mid;
      else high = mid - 1;
    }
    return low;
  }

  /** The items whose rows fall in `rows`. */
  itemsInRows(rows: Range): Range {
    if (!this.grouped) return rows;
    if (rows.end <= rows.start) return { start: 0, end: 0 };
    const firstGroup = this.groupOfRow(rows.start);
    const start = rows.start === this.labelRow(firstGroup) ? this.itemStarts[firstGroup] : rows.start - firstGroup - 1;
    const lastGroup = this.groupOfRow(rows.end - 1);
    const end = rows.end - 1 === this.labelRow(lastGroup) ? this.itemStarts[lastGroup] : rows.end - 1 - lastGroup;
    return { start, end: Math.max(start, end) };
  }

  /** The groups with at least one row (label or item) in `rows`. */
  groupsInRows(rows: Range): Range {
    if (!this.grouped || rows.end <= rows.start) return { start: 0, end: 0 };
    return { start: this.groupOfRow(rows.start), end: this.groupOfRow(rows.end - 1) + 1 };
  }
}
