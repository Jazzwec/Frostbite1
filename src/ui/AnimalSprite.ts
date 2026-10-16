import Phaser from 'phaser';
import type { AnimalKind, Point } from '../engine/types';
import { COLOURS } from '../theme';

/** Same catch-up easing as Meagan: the engine moves animals in 10 Hz steps. */
const FOLLOW_RATE = 14;
const HP_W = 70;

interface Look {
  body: number;
  scale: number;
}

const LOOKS: Record<AnimalKind, Look> = {
  wolf: { body: 0x8a96a3, scale: 0.8 },
  bear: { body: 0x7a5236, scale: 1.15 },
  oldBear: { body: 0x4a3324, scale: 1.5 },
};

/** Placeholder animal: a four-legged blob with ears, facing its walking direction, with an HP bar. Feet at the origin. */
export class AnimalSprite extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  private readonly hp: Phaser.GameObjects.Graphics;
  private readonly barY: number;

  constructor(scene: Phaser.Scene, at: Point, kind: AnimalKind) {
    super(scene, at.x, at.y);
    const { body, scale } = LOOKS[kind];
    const ink = COLOURS.ink;
    const g = scene.add.graphics();
    // Legs, body, head, ears, eye, snout.
    g.fillStyle(ink, 1);
    for (const lx of [-26, -12, 10, 24]) g.fillRoundedRect(lx, -14, 8, 14, 3);
    g.fillStyle(body, 1).fillEllipse(0, -26, 70, 34);
    g.lineStyle(4, ink, 1).strokeEllipse(0, -26, 70, 34);
    g.fillStyle(body, 1).fillCircle(34, -38, 15);
    g.lineStyle(4, ink, 1).strokeCircle(34, -38, 15);
    if (kind === 'wolf') {
      g.fillStyle(body, 1).fillTriangle(26, -48, 32, -64, 38, -50);
      g.lineStyle(3, ink, 1).strokeTriangle(26, -48, 32, -64, 38, -50);
      g.fillStyle(body, 1).fillTriangle(-34, -30, -52, -38, -36, -20); // tail
    } else {
      g.fillStyle(body, 1).fillCircle(26, -51, 6).fillCircle(40, -52, 6);
      if (kind === 'oldBear') g.lineStyle(3, COLOURS.ice, 0.9).lineBetween(28, -46, 38, -34); // scar
    }
    g.fillStyle(ink, 1).fillCircle(39, -41, 2.5).fillCircle(48, -35, 3);
    g.setScale(scale);
    this.figure = scene.add.container(0, 0, [g]);
    this.barY = -70 * scale;
    this.hp = scene.add.graphics();
    this.add([scene.add.ellipse(0, 0, 70 * scale, 14, ink, 0.18), this.figure, this.hp]);
    this.setDepth(this.y);
    scene.add.existing(this);
  }

  follow(target: Point, deltaMs: number): void {
    const k = 1 - Math.exp((-FOLLOW_RATE * deltaMs) / 1000);
    const dx = (target.x - this.x) * k;
    this.x += dx;
    this.y += (target.y - this.y) * k;
    if (Math.abs(dx) > 0.2) this.figure.scaleX = dx > 0 ? 1 : -1;
    this.setDepth(this.y);
  }

  setHealth(fraction: number): void {
    const f = Phaser.Math.Clamp(fraction, 0, 1);
    this.hp.clear();
    this.hp.fillStyle(COLOURS.ink, 0.8).fillRect(-HP_W / 2 - 2, this.barY - 2, HP_W + 4, 12);
    this.hp.fillStyle(COLOURS.danger, 1).fillRect(-HP_W / 2, this.barY, HP_W * f, 8);
  }
}
