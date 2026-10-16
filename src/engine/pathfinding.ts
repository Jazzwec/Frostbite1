// Grid A* with line-of-sight smoothing, for walking around buildings. Pure: knows nothing about game state.
import type { Point, Rect } from './types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface NavGrid {
  bounds: Bounds;
  cellSize: number;
  cols: number;
  rows: number;
  /** 1 = walkable, row-major. */
  walkable: Uint8Array;
  /** Obstacles already grown by the walker's clearance. */
  blockers: Rect[];
}

/** Build a grid over `bounds` where a cell is walkable if its centre is outside every obstacle grown by `clearance`. */
export function buildGrid(bounds: Bounds, obstacles: Rect[], cellSize: number, clearance: number): NavGrid {
  const blockers = obstacles.map((r) => ({ x: r.x - clearance, y: r.y - clearance, w: r.w + 2 * clearance, h: r.h + 2 * clearance }));
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
  const rows = Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / cellSize));
  const grid: NavGrid = { bounds, cellSize, cols, rows, walkable: new Uint8Array(cols * rows), blockers };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) grid.walkable[r * cols + c] = isBlocked(grid, cellCentre(grid, c, r)) ? 0 : 1;
  }
  return grid;
}

/** Outside the bounds or inside a (grown) obstacle. */
export function isBlocked(grid: NavGrid, p: Point): boolean {
  const b = grid.bounds;
  if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) return true;
  return grid.blockers.some((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
}

/**
 * Waypoints from `from` to `to`, excluding the start. A blocked target snaps to the nearest walkable cell;
 * a blocked start steps out to the nearest walkable cell first. Returns [] when there is no way through.
 */
export function findPath(grid: NavGrid, from: Point, to: Point): Point[] {
  const out: Point[] = [];
  let start = from;
  if (isBlocked(grid, from)) {
    const c = nearestWalkableCell(grid, from);
    if (c < 0) return [];
    start = centreOf(grid, c);
    out.push(start);
  }
  const goalCell = isBlocked(grid, to) ? nearestWalkableCell(grid, to) : cellAt(grid, to);
  if (goalCell < 0) return [];
  const goal = isBlocked(grid, to) ? centreOf(grid, goalCell) : { x: to.x, y: to.y };

  if (hasLineOfSight(grid, start, goal)) return [...out, goal];

  const cells = aStar(grid, walkableCellNear(grid, start), goalCell);
  if (!cells) return [];
  const raw = [start, ...cells.slice(1, -1).map((c) => centreOf(grid, c)), goal];
  return [...out, ...smooth(grid, raw).slice(1)];
}

/** True if the straight segment a→b stays clear of every obstacle and inside the bounds. */
export function hasLineOfSight(grid: NavGrid, a: Point, b: Point): boolean {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len / (grid.cellSize / 4)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isBlocked(grid, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
  }
  return true;
}

// ---------- Internals ----------

function cellCentre(grid: NavGrid, c: number, r: number): Point {
  return { x: grid.bounds.minX + (c + 0.5) * grid.cellSize, y: grid.bounds.minY + (r + 0.5) * grid.cellSize };
}

function centreOf(grid: NavGrid, cell: number): Point {
  return cellCentre(grid, cell % grid.cols, Math.floor(cell / grid.cols));
}

function cellAt(grid: NavGrid, p: Point): number {
  const c = Math.min(grid.cols - 1, Math.max(0, Math.floor((p.x - grid.bounds.minX) / grid.cellSize)));
  const r = Math.min(grid.rows - 1, Math.max(0, Math.floor((p.y - grid.bounds.minY) / grid.cellSize)));
  return r * grid.cols + c;
}

/** The point's own cell if walkable, otherwise the nearest walkable one. */
function walkableCellNear(grid: NavGrid, p: Point): number {
  const c = cellAt(grid, p);
  return grid.walkable[c] ? c : nearestWalkableCell(grid, p);
}

function nearestWalkableCell(grid: NavGrid, p: Point): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < grid.walkable.length; i++) {
    if (!grid.walkable[i]) continue;
    const q = centreOf(grid, i);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const NEIGHBOURS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/** 8-way A* over cells, never cutting a blocked corner. Returns the cell chain start..goal, or null. */
function aStar(grid: NavGrid, start: number, goal: number): number[] | null {
  const { cols, rows, walkable } = grid;
  const n = cols * rows;
  const g = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gc = goal % cols;
  const gr = Math.floor(goal / cols);
  const h = (cell: number): number => {
    const dx = Math.abs((cell % cols) - gc);
    const dy = Math.abs(Math.floor(cell / cols) - gr);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); // octile
  };
  const open = new MinHeap();
  g[start] = 0;
  open.push(start, h(start));

  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goal) {
      const chain = [cur];
      while (came[chain[0]] >= 0) chain.unshift(came[chain[0]]);
      return chain;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cc = cur % cols;
    const cr = Math.floor(cur / cols);
    for (const [dx, dy, cost] of NEIGHBOURS) {
      const nc = cc + dx;
      const nr = cr + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const next = nr * cols + nc;
      if (!walkable[next] || closed[next]) continue;
      if (dx !== 0 && dy !== 0 && (!walkable[cr * cols + nc] || !walkable[nr * cols + cc])) continue;
      const tentative = g[cur] + cost;
      if (tentative < g[next]) {
        g[next] = tentative;
        came[next] = cur;
        open.push(next, tentative + h(next));
      }
    }
  }
  return null;
}

/** String-pulling: from each anchor, jump to the farthest later point still in straight sight. */
function smooth(grid: NavGrid, pts: Point[]): Point[] {
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !hasLineOfSight(grid, pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** Binary min-heap of (item, priority). */
class MinHeap {
  private items: number[] = [];
  private prios: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, prio: number): void {
    const { items, prios } = this;
    let i = items.length;
    items.push(item);
    prios.push(prio);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (prios[parent] <= prios[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const { items, prios } = this;
    const top = items[0];
    const lastItem = items.pop()!;
    const lastPrio = prios.pop()!;
    if (items.length > 0) {
      items[0] = lastItem;
      prios[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && prios[l] < prios[m]) m = l;
        if (r < items.length && prios[r] < prios[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prios[a], this.prios[b]] = [this.prios[b], this.prios[a]];
  }
}
