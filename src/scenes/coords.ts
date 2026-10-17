// Engine map units ↔ Phaser world pixels (1 unit = 1 logical px). The world is the walkable map plus snow at the
// sides, a sky band above the top edge and extra snow at the bottom; the camera scrolls over it.
import { MAP_BOUNDS } from '../engine/map';
import type { Point } from '../engine/types';

/** Snow beyond the walkable left and right edges. */
const SIDE_MARGIN = 60;
/** Sky above the walkable top edge; also keeps the top row clear of the heat bar and city strip. */
export const SKY_H = 420;
/** Snow below the walkable bottom edge, so the bottom row clears the tab bar when scrolled all the way down. */
const BOTTOM_MARGIN = 220;

/** Where map (0, 0), the furnace's base, sits in the world. */
export const ORIGIN: Point = { x: SIDE_MARGIN - MAP_BOUNDS.minX, y: SKY_H - MAP_BOUNDS.minY };
export const WORLD_W = MAP_BOUNDS.maxX - MAP_BOUNDS.minX + 2 * SIDE_MARGIN;
export const WORLD_H = SKY_H + (MAP_BOUNDS.maxY - MAP_BOUNDS.minY) + BOTTOM_MARGIN;

/** Map units → world pixels. */
export function toScreen(p: Point): Point {
  return { x: p.x + ORIGIN.x, y: p.y + ORIGIN.y };
}

/** World pixels → map units. */
export function toWorld(p: Point): Point {
  return { x: p.x - ORIGIN.x, y: p.y - ORIGIN.y };
}
