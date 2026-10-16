// City layout in engine units. The furnace sits at the origin; the renderer maps these to screen pixels (1 unit = 1 logical px).
import type { Bounds } from './pathfinding';
import type { BuildingKey, GameState, JobKey, Point, Rect, StoredResource } from './types';

export const FURNACE: Point = { x: 0, y: 0 };

/** Where Meagan's centre may walk: the snowfield below the horizon. */
export const MAP_BOUNDS: Bounds = { minX: -370, minY: -400, maxX: 370, maxY: 660 };

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

export interface SiteDef {
  /** Buildings that start in place; every other site is an empty plot. */
  fixed?: BuildingKey;
  /** Ground the building stands on; blocks walking once something is built or under construction. */
  footprint: Rect;
  /** Where Meagan stands to use it, in front of the footprint. Deposits and pick-ups happen around here. */
  drop: Point;
}

/** Footprint size of an ordinary building or plot. */
const PLOT_W = 130;
const PLOT_D = 60;

function plot(cx: number, base: number, fixed?: BuildingKey): SiteDef {
  return { fixed, footprint: { x: cx - PLOT_W / 2, y: base - PLOT_D, w: PLOT_W, h: PLOT_D }, drop: { x: cx, y: base + 40 } };
}

/** Every building spot. Index 0 is the furnace; its footprint covers the stone body's base. */
export const SITES: SiteDef[] = [
  { fixed: 'furnace', footprint: { x: -150, y: -200, w: 300, h: 200 }, drop: { x: 0, y: 50 } },
  plot(-275, -70, 'lumberYard'),
  plot(275, -70, 'huntingLodge'),
  plot(-270, 120),
  plot(270, 120),
  plot(-270, 280),
  plot(0, 280),
  plot(270, 280),
  plot(-270, 440),
  plot(0, 440),
  plot(270, 440),
  plot(-135, 600),
  plot(135, 600),
];

export const MEAGAN_START: Point = SITES[0].drop;

export const PLACES = {
  furnace: MEAGAN_START,
  forest: FOREST,
  hunting: HUNTING_GROUNDS,
} as const;
export type PlaceKey = keyof typeof PLACES;

/** Index of the site a building stands on, or -1 if it hasn't been placed. */
export function siteIndexOf(s: GameState, key: BuildingKey): number {
  return s.sites.findIndex((site) => site.building === key);
}

/** Drop point of the site a building stands on, or null if it hasn't been placed. */
export function siteOf(s: GameState, key: BuildingKey): Point | null {
  const i = siteIndexOf(s, key);
  return i < 0 ? null : SITES[i].drop;
}

/** Site whose pile holds a resource: Wood at the Lumber Yard, Food at the Hunting Lodge, Materials at the Workshop (or the furnace before there is one). */
export function pileSiteIndex(s: GameState, res: StoredResource): number {
  if (res === 'wood') return siteIndexOf(s, 'lumberYard');
  if (res === 'food') return siteIndexOf(s, 'huntingLodge');
  const workshop = siteIndexOf(s, 'workshop');
  return workshop >= 0 && s.buildings.workshop > 0 ? workshop : 0;
}

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
