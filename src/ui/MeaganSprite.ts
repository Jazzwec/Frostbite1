import Phaser from 'phaser';
import type { Point, StoredResource } from '../engine/types';
import { COLOURS, CSS, FONT } from '../theme';
import { RESOURCE_LABELS, formatNumber } from './format';

/** How quickly the sprite catches up with the engine position (which moves in 10 Hz steps). Higher = snappier. */
const FOLLOW_RATE = 18;
const BOB_HEIGHT = 6;
const BOB_SPEED = 0.018;

/** Placeholder Meagan: parka, ember scarf and a bag counter above her head. Feet at the container origin. */
export class MeaganSprite extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  private readonly bagLabel: Phaser.GameObjects.Text;
  private readonly hp: Phaser.GameObjects.Graphics;
  private hpShown = 1;
  private bagText = '';
  private walkTime = 0;

  constructor(scene: Phaser.Scene, at: Point) {
    super(scene, at.x, at.y);
    const shadow = scene.add.ellipse(0, 0, 56, 16, COLOURS.ink, 0.18);

    const g = scene.add.graphics();
    const ink = COLOURS.ink;
    // Boots.
    g.fillStyle(ink, 1).fillRoundedRect(-18, -14, 15, 14, 5).fillRoundedRect(3, -14, 15, 14, 5);
    // Parka.
    g.fillStyle(COLOURS.parka, 1).fillRoundedRect(-24, -66, 48, 56, 16);
    g.lineStyle(5, ink, 1).strokeRoundedRect(-24, -66, 48, 56, 16);
    g.lineStyle(3, COLOURS.ice, 0.8).lineBetween(0, -58, 0, -14);
    // Hood with fur trim, face, hair.
    g.fillStyle(COLOURS.ice, 1).fillCircle(0, -86, 25);
    g.lineStyle(5, ink, 1).strokeCircle(0, -86, 25);
    g.fillStyle(COLOURS.skin, 1).fillCircle(2, -86, 16);
    g.fillStyle(COLOURS.hair, 1).fillEllipse(-2, -98, 30, 12);
    // Eye and cheek on the facing side (+x).
    g.fillStyle(ink, 1).fillCircle(9, -88, 2.6);
    g.fillStyle(COLOURS.ember, 0.35).fillCircle(11, -80, 4);
    // Scarf.
    g.fillStyle(COLOURS.ember, 1).fillRoundedRect(-20, -70, 40, 11, 5);
    g.fillRect(-16, -62, 9, 20);

    this.figure = scene.add.container(0, 0, [g]);
    this.bagLabel = scene.add
      .text(0, -128, '', {
        fontFamily: FONT,
        fontSize: '24px',
        color: CSS.ink,
        backgroundColor: CSS.ice,
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);

    this.hp = scene.add.graphics();
    this.add([shadow, this.figure, this.hp, this.bagLabel]);
    scene.add.existing(this);
  }

  /** Ease towards the engine position, face the walking direction and bob while moving. */
  follow(target: Point, walking: boolean, deltaMs: number): void {
    const k = 1 - Math.exp((-FOLLOW_RATE * deltaMs) / 1000);
    const dx = (target.x - this.x) * k;
    this.x += dx;
    this.y += (target.y - this.y) * k;
    if (Math.abs(dx) > 0.3) this.figure.scaleX = dx > 0 ? 1 : -1;

    const moving = walking || Math.hypot(target.x - this.x, target.y - this.y) > 1;
    this.walkTime = moving ? this.walkTime + deltaMs : 0;
    this.figure.y = -Math.abs(Math.sin(this.walkTime * BOB_SPEED)) * BOB_HEIGHT;
    this.setDepth(this.y);
  }

  /** HP bar while she's hurt; greyed out while injured (she can't move until the attack ends). */
  setHealth(fraction: number, injured: boolean): void {
    const f = Phaser.Math.Clamp(fraction, 0, 1);
    this.figure.setAlpha(injured ? 0.5 : 1);
    if (f === this.hpShown) return;
    this.hpShown = f;
    this.hp.clear();
    if (f >= 1) return;
    this.hp.fillStyle(COLOURS.ink, 0.8).fillRect(-37, -122, 74, 12);
    this.hp.fillStyle(injured ? COLOURS.slate : COLOURS.danger, 1).fillRect(-35, -120, 70 * f, 8);
  }

  /** Bag contents plus how full it is, e.g. "12 Wood · 3 Mat (15/30)". Hidden when empty. */
  setBag(bag: Record<StoredResource, number>, limit: number): void {
    const entries = (Object.entries(bag) as Array<[StoredResource, number]>).filter(([, v]) => v >= 1);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const parts = entries.map(([k, v]) => `${formatNumber(v)} ${RESOURCE_LABELS[k]}`);
    const text = parts.length > 0 ? `${parts.join(' · ')} (${formatNumber(total)}/${formatNumber(limit)})` : '';
    if (text === this.bagText) return;
    this.bagText = text;
    this.bagLabel.setText(text).setVisible(text !== '');
  }
}
