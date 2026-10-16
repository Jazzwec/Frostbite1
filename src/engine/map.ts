// City layout in engine units. The furnace sits at the origin; the renderer maps these to screen pixels.
import type { JobKey, Point } from './types';

export const FURNACE: Point = { x: 0, y: 0 };

/** Where Meagan gathers by hand. */
export const FOREST: Point = { x: -320, y: -260 };
export const HUNTING_GROUNDS: Point = { x: 320, y: -260 };

/** Where Jans stand while working each job. Guards use the ring around the furnace instead. */
export const JOB_SITES: Record<Exclude<JobKey, 'guard'>, Point> = {
  chop: { x: -220, y: -160 },
  hunt: { x: 220, y: -160 },
  build: { x: -240, y: 120 },
  research: { x: 240, y: 120 },
  scavenge: { x: 0, y: 280 },
};

export const WATCHTOWER: Point = { x: 0, y: -220 };

export const PLACES = {
  furnace: FURNACE,
  forest: FOREST,
  hunting: HUNTING_GROUNDS,
  watchtower: WATCHTOWER,
} as const;
export type PlaceKey = keyof typeof PLACES;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Move `p` towards `target` by at most `step`; returns true if it arrived. */
export function moveTowards(p: Point, target: Point, step: number): boolean {
  const d = distance(p, target);
  if (d <= step) {
    p.x = target.x;
    p.y = target.y;
    return true;
  }
  p.x += ((target.x - p.x) / d) * step;
  p.y += ((target.y - p.y) / d) * step;
  return false;
}
