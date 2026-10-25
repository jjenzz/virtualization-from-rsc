/** Rows per block. Each block keeps running totals, so lookups never walk every row. */
const BLOCK = 1024;

/**
 * Item heights for a list of `count` items, stored sparsely: only measured items
 * are recorded. Unmeasured items count as the average of the measured ones, or
 * `defaultSize` until something is measured, so the total height (and the
 * scrollbar) settles quickly instead of drifting as rows are measured.
 *
 * Memory grows with the items measured (plus two numbers per BLOCK items), never
 * with `count` itself, so a 1M-item list costs nothing until it's scrolled.
 *
 * Each block keeps how many of its items are measured and their total height, so
 * an item's position is `(unmeasured before it) * estimate + (measured height
 * before it)`, found from the block totals and at most one block's items.
 */
export class Sizes {
  readonly count: number;
  readonly defaultSize: number;
  /** Measured heights by index, grouped by block. */
  private readonly blocks = new Map<number, Map<number, number>>();
  private readonly blockCounts: Float64Array;
  private readonly blockSums: Float64Array;
  private measuredCount = 0;
  private measuredSum = 0;
  /** Running totals of the block counts and sums before each block. Rebuilt lazily. */
  private prefix: { counts: Float64Array; sums: Float64Array } | null = null;

  constructor(count: number, defaultSize: number, previous?: Sizes) {
    this.count = count;
    this.defaultSize = defaultSize;
    const blocks = Math.ceil(count / BLOCK);
    this.blockCounts = new Float64Array(blocks);
    this.blockSums = new Float64Array(blocks);
    // Keep what was measured before (the count or the default size changed).
    previous?.blocks.forEach((rows) => rows.forEach((size, index) => index < count && this.set(index, size)));
  }

  /** The height used for unmeasured items: the average measured height, or the default. */
  get estimate(): number {
    return this.measuredCount > 0 ? this.measuredSum / this.measuredCount : this.defaultSize;
  }

  /** Records a measured height. Returns whether anything changed. */
  set(index: number, size: number): boolean {
    const b = Math.floor(index / BLOCK);
    let rows = this.blocks.get(b);
    if (!rows) this.blocks.set(b, (rows = new Map()));
    const previous = rows.get(index);
    if (previous === size) return false;
    rows.set(index, size);
    if (previous === undefined) {
      this.blockCounts[b] += 1;
      this.measuredCount += 1;
    }
    this.blockSums[b] += size - (previous ?? 0);
    this.measuredSum += size - (previous ?? 0);
    this.prefix = null;
    return true;
  }

  /** The item's height: measured, or the estimate. */
  sizeOf(index: number): number {
    return this.blocks.get(Math.floor(index / BLOCK))?.get(index) ?? this.estimate;
  }

  /** Where item `index` starts, in px. `start(count)` is the total height. */
  start(index: number): number {
    const b = Math.floor(index / BLOCK);
    let measured = 0;
    let measuredHeight = 0;
    this.blocks.get(b)?.forEach((size, i) => {
      if (i < index) {
        measured += 1;
        measuredHeight += size;
      }
    });
    return this.blockStart(b) + (index - b * BLOCK - measured) * this.estimate + measuredHeight;
  }

  /** The item at `offset` px (clamped to the list). */
  indexAt(offset: number): number {
    if (this.count === 0 || offset <= 0) return 0;
    // Last block that starts at or before `offset`.
    let low = 0;
    let high = this.blockCounts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.blockStart(mid) <= offset) low = mid;
      else high = mid - 1;
    }
    // Then walk that block's items.
    let index = low * BLOCK;
    let position = this.blockStart(low);
    const end = Math.min(this.count, (low + 1) * BLOCK);
    while (index < end - 1 && position + this.sizeOf(index) <= offset) {
      position += this.sizeOf(index);
      index++;
    }
    return index;
  }

  private blockStart(b: number): number {
    if (!this.prefix) {
      const n = this.blockCounts.length;
      const counts = new Float64Array(n + 1);
      const sums = new Float64Array(n + 1);
      for (let i = 0; i < n; i++) {
        counts[i + 1] = counts[i] + this.blockCounts[i];
        sums[i + 1] = sums[i] + this.blockSums[i];
      }
      this.prefix = { counts, sums };
    }
    const i = Math.min(b, this.blockCounts.length);
    return (b * BLOCK - this.prefix.counts[i]) * this.estimate + this.prefix.sums[i];
  }
}
