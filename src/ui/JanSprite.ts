import Phaser from 'phaser';
import type { Point } from '../engine/types';
import { COLOURS, CSS, FONT } from '../theme';
import { artImage, hasArt } from './art';

/** Jans walking to work is cosmetic (output starts at assignment), so their pace lives here, not in balance.ts. */
const WALK_SPEED = 120;
const BOB_HEIGHT = 5;
const BOB_SPEED = 0.018;
/** While working, a gentle bob every so often. */
const WORK_BOB_SPEED = 0.006;
/** Speech bubbles float above everything on the map, just under the HUD. */
const BUBBLE_DEPTH = 9500;
const BUBBLE_WIDTH = 300;
/** Height of a Jan's generated art, in logical px. */
const ART_HEIGHT = 112;

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
  private bubble: Phaser.GameObjects.Text | null = null;
  private bubbleUntil = 0;

  /** `artId` picks the generated art (e.g. 'jan-chef'); plain 'jan' art, then the drawn shape, are the fallbacks. */
  constructor(scene: Phaser.Scene, at: Point, frozen: boolean, artId = 'jan') {
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
    const id = hasArt(scene, artId) ? artId : 'jan';
    const look = hasArt(scene, id) ? artImage(scene, id, 0, 0, { height: ART_HEIGHT }) : g;
    if (look !== g) g.destroy();
    this.figure = scene.add.container(0, 0, [look]);
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

  /** A guard knocked out in a fight lies down, greyed, until the attack ends. */
  setKnockedOut(out: boolean): void {
    this.figure.setAngle(out ? -90 : 0).setAlpha(out ? 0.5 : 1);
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

  /** Say something in a speech bubble above his head for a few seconds. */
  say(text: string, ms = 3500): void {
    this.bubble?.destroy();
    this.bubble = this.scene.add
      .text(this.x, this.y - 130, text, {
        fontFamily: FONT,
        fontSize: '24px',
        color: CSS.ink,
        backgroundColor: CSS.ice,
        padding: { x: 12, y: 8 },
        align: 'center',
        wordWrap: { width: BUBBLE_WIDTH },
      })
      .setOrigin(0.5, 1)
      .setDepth(BUBBLE_DEPTH);
    this.bubbleUntil = this.clock + ms;
  }

  /** A happy hop (just thawed). */
  bounce(): void {
    this.scene.tweens.add({ targets: this, scaleY: 1.25, scaleX: 0.85, duration: 130, yoyo: true, repeat: 1, ease: 'Quad.out' });
  }

  get speaking(): boolean {
    return this.bubble !== null;
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  override destroy(fromScene?: boolean): void {
    this.bubble?.destroy();
    this.bubble = null;
    super.destroy(fromScene);
  }

  tick(deltaMs: number): void {
    this.clock += deltaMs;
    if (this.bubble) {
      if (this.clock >= this.bubbleUntil) {
        this.bubble.destroy();
        this.bubble = null;
      } else this.bubble.setPosition(this.x, this.y - 130);
    }
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
