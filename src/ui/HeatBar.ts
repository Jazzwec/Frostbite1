import Phaser from 'phaser';
import { COLOURS, CSS, FONT } from '../theme';

/** Below this fraction the bar turns cold blue (matches the brief's 30% "jobs at half speed" line). */
const COLD_LINE = 0.3;

/** Furnace heat meter. Phase 2 drives it from the engine via setValue(). */
export class HeatBar extends Phaser.GameObjects.Container {
  private readonly barW: number;
  private readonly barH = 44;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly pct: Phaser.GameObjects.Text;
  private value = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);
    this.barW = width;

    const label = scene.add.text(0, 0, 'Heat', { fontFamily: FONT, fontSize: '34px', color: CSS.ink });
    this.pct = scene.add
      .text(width, 0, '', { fontFamily: FONT, fontSize: '34px', color: CSS.ink })
      .setOrigin(1, 0);

    const track = scene.add.graphics();
    track.fillStyle(COLOURS.ice, 1).fillRoundedRect(0, 52, width, this.barH, 14);
    track.lineStyle(4, COLOURS.line, 1).strokeRoundedRect(0, 52, width, this.barH, 14);
    // Tick mark at the cold line.
    track.fillStyle(COLOURS.slate, 0.5).fillRect(width * COLD_LINE - 2, 52, 4, this.barH);

    this.fill = scene.add.graphics();
    this.add([label, this.pct, track, this.fill]);
    scene.add.existing(this);
    this.redraw();
  }

  /** Set heat as a fraction of the furnace cap (0..1). */
  setValue(fraction: number): this {
    this.value = Phaser.Math.Clamp(fraction, 0, 1);
    this.redraw();
    return this;
  }

  private redraw(): void {
    const cold = this.value < COLD_LINE;
    const w = Math.max(0, (this.barW - 8) * this.value);
    this.fill.clear();
    if (w > 0) {
      this.fill.fillStyle(cold ? COLOURS.frost : COLOURS.ember, 1);
      this.fill.fillRoundedRect(4, 56, w, this.barH - 8, Math.min(10, w / 2));
      this.fill.fillStyle(0xffffff, 0.25).fillRoundedRect(8, 60, Math.max(0, w - 8), 8, 4);
    }
    this.pct.setText(`${Math.round(this.value * 100)}%`);
  }
}
