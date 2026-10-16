// Engine map units ↔ logical screen pixels. 1 unit = 1 px; the furnace's base (map origin) sits here on screen.
import type { Point } from '../engine/types';
import { GAME_WIDTH } from '../theme';

export const ORIGIN: Point = { x: GAME_WIDTH / 2, y: 980 };

export function toScreen(p: Point): Point {
  return { x: p.x + ORIGIN.x, y: p.y + ORIGIN.y };
}

export function toWorld(p: Point): Point {
  return { x: p.x - ORIGIN.x, y: p.y - ORIGIN.y };
}
