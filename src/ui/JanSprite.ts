import Phaser from 'phaser';
import type { Point } from '../engine/types';
import { COLOURS } from '../theme';

/** Jans walking to work is cosmetic (output starts at assignment), so their pace lives here, not in balance.ts. */
const WALK_SPEED = 120;
const BOB_HEIGHT = 5;
const BOB_SPEED = 0.018;
/** While working, a gentle bob every so often. */
const WORK_BOB_SPEED = 0.006;

/**
 * Placeholder Jan: beanie, beard, brown coat. Frozen Jans stand in an ice block, with a ring that empties
 * as a caravan Jan's patience runs out. Feet at the container origin; coordinates are screen pixels.
 */
export class JanSprite extends Phaser.GameObjects.Container {
  /** Map-space spot he is heading for, so the scene can tell when it changes. */
  target: Point | null = null;
  private readonly figure: Phaser.GameObjects.Container;
  private readonly timer: Phaser.GameObjects.Graphics | null;
  private path: Point[] = [];
  private clock = Math.random() * 1000;

  constructor(scene: Phaser.Scene, at: Point, frozen: boolean) {
    super(scene, at.x, at.y);
    const ink = COLOURS.ink;
    const shadow = scene.add.ellipse(0, 0, 50, 14, ink, 0.18);

    const g = scene.add.graphics();
    // Boots and coat.
    g.fillStyle(ink, 1).fillRoundedRect(-16, -12, 13, 12, 4).fillRoundedRect(3, -12, 13, 12, 4);
    g.fillStyle(COLOURS.timber, 1).fillRoundedRect(-21, -58, 42, 48, 14);
    g.lineStyle(5, ink, 1).strokeRoundedRect(-21, -58, 42, 48, 14);
    // Head, beard, beanie with a bobble.
    g.fillStyle(COLOURS.skin, 1).fillCircle(0, -76, 17);
    g.lineStyle(4, ink, 1).strokeCircle(0, -76, 17);
    g.fillStyle(COLOURS.hair, 1).fillEllipse(2, -64, 26, 14);
    g.fillStyle(ink, 1).fillCircle(7, -79, 2.4);
    g.fillStyle(COLOURS.frost, 1).fillRoundedRect(-18, -98, 36, 16, 7);
    g.fillStyle(COLOURS.ice, 1).fillCircle(0, -100, 6);
    this.figure = scene.add.container(0, 0, [g]);
    this.add([shadow, this.figure]);

    if (frozen) {
      const ice = scene.add.graphics();
      ice.fillStyle(COLOURS.frostSoft, 0.55).fillRoundedRect(-30, -112, 60, 116, 12);
      ice.lineStyle(4, COLOURS.frost, 1).strokeRoundedRect(-30, -112, 60, 116, 12);
      ice.lineStyle(3, COLOURS.ice, 0.9).lineBetween(-20, -100, -8, -86).lineBetween(14, -40, 22, -28);
      this.add(ice);
      this.timer = scene.add.graphics();
      this.add(this.timer);
    } else {
      this.timer = null;
    }

    this.setDepth(this.y);
    scene.add.existing(this);
  }

  /** Caravan patience left (0..1), or null for no ring. */
  setTimer(fraction: number | null): void {
    if (!this.timer) return;
    this.timer.clear();
    if (fraction === null) return;
    const end = -Math.PI / 2 + Math.PI * 2 * Phaser.Math.Clamp(fraction, 0, 1);
    this.timer.lineStyle(6, COLOURS.ember, 1).beginPath().arc(0, -136, 14, -Math.PI / 2, end, false).strokePath();
  }

  /** Follow these screen-space waypoints. */
  walk(path: Point[]): void {
    this.path = path;
  }

  tick(deltaMs: number): void {
    this.clock += deltaMs;
    let step = (WALK_SPEED * deltaMs) / 1000;
    const walking = this.path.length > 0;
    while (step > 0 && this.path.length > 0) {
      const next = this.path[0];
      const d = Math.hypot(next.x - this.x, next.y - this.y);
      if (d > step) {
        const dx = ((next.x - this.x) / d) * step;
        this.x += dx;
        this.y += ((next.y - this.y) / d) * step;
        if (Math.abs(dx) > 0.1) this.figure.scaleX = dx > 0 ? 1 : -1;
        break;
      }
      this.setPosition(next.x, next.y);
      step -= d;
      this.path.shift();
    }
    if (this.timer) return; // frozen Jans don't move
    const bob = walking ? Math.abs(Math.sin(this.clock * BOB_SPEED)) : Math.max(0, Math.sin(this.clock * WORK_BOB_SPEED)) * 0.6;
    this.figure.y = -bob * BOB_HEIGHT;
    this.setDepth(this.y);
  }
}
