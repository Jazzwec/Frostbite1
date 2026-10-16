import { describe, expect, it } from 'vitest';
import { buildGrid, findPath, hasLineOfSight, isBlocked, type Bounds } from './pathfinding';
import type { Point, Rect } from './types';

const BOUNDS: Bounds = { minX: -200, minY: -200, maxX: 200, maxY: 200 };
const WALL: Rect = { x: -100, y: -20, w: 200, h: 40 };

/** Every point along every leg of the walk, sampled finely. */
function walkClear(grid: ReturnType<typeof buildGrid>, from: Point, path: Point[]): boolean {
  let a = from;
  for (const b of path) {
    if (!hasLineOfSight(grid, a, b)) return false;
    a = b;
  }
  return true;
}

describe('findPath', () => {
  it('walks straight when nothing is in the way', () => {
    const grid = buildGrid(BOUNDS, [WALL], 20, 10);
    expect(findPath(grid, { x: -150, y: 100 }, { x: 150, y: 120 })).toEqual([{ x: 150, y: 120 }]);
  });

  it('routes around a building without ever entering its grown footprint', () => {
    const grid = buildGrid(BOUNDS, [WALL], 20, 10);
    const from = { x: 0, y: 100 };
    const to = { x: 0, y: -100 };
    const path = findPath(grid, from, to);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(to);
    expect(walkClear(grid, from, path)).toBe(true);
    // Smoothed: only a couple of corners, not a staircase of cells.
    expect(path.length).toBeLessThanOrEqual(4);
  });

  it('snaps a target inside a building to the nearest walkable spot', () => {
    const grid = buildGrid(BOUNDS, [WALL], 20, 10);
    const path = findPath(grid, { x: 0, y: 100 }, { x: 0, y: 0 });
    const end = path.at(-1)!;
    expect(isBlocked(grid, end)).toBe(false);
    expect(Math.abs(end.y)).toBeLessThanOrEqual(50);
  });

  it('steps out first when the walker starts inside a building', () => {
    const grid = buildGrid(BOUNDS, [WALL], 20, 10);
    const path = findPath(grid, { x: 0, y: 0 }, { x: 0, y: 150 });
    expect(isBlocked(grid, path[0])).toBe(false);
    expect(path.at(-1)).toEqual({ x: 0, y: 150 });
  });

  it('returns no path when the target is walled off', () => {
    // Two walls fence off the bottom-right corner against the map edges.
    const box: Rect[] = [
      { x: 60, y: 60, w: 140, h: 20 },
      { x: 60, y: 60, w: 20, h: 140 },
    ];
    const grid = buildGrid(BOUNDS, box, 20, 10);
    expect(findPath(grid, { x: -150, y: -150 }, { x: 150, y: 150 })).toEqual([]);
  });
});
