import Phaser from 'phaser';
import { COLOURS, GAME_HEIGHT, GAME_WIDTH } from '../theme';
import { HeatBar } from '../ui/HeatBar';

const HORIZON = 560;
const FURNACE_X = GAME_WIDTH / 2;
const FURNACE_Y = 980; // base of the furnace

export class CityScene extends Phaser.Scene {
  heatBar!: HeatBar;

  constructor() {
    super('City');
  }

  create(): void {
    this.makeTextures();
    this.drawBackground();
    this.drawFurnace();
    this.addSnowfall();

    this.heatBar = new HeatBar(this, 48, 36, GAME_WIDTH - 96);
    this.heatBar.setDepth(100);
    // Placeholder until the engine exists (Phase 2).
    this.heatBar.setValue(1);
  }

  /** Small runtime textures for particles, so there are no image assets yet. */
  private makeTextures(): void {
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture('flake', 16, 16);
    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
    g.generateTexture('ember', 12, 12);
    g.destroy();
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    // Sky fades into the snowfield.
    g.fillGradientStyle(COLOURS.sky, COLOURS.sky, COLOURS.snow, COLOURS.snow, 1);
    g.fillRect(0, 0, GAME_WIDTH, HORIZON);
    g.fillStyle(COLOURS.snow, 1).fillRect(0, HORIZON, GAME_WIDTH, GAME_HEIGHT - HORIZON);

    // Distant pines on the horizon.
    g.fillStyle(COLOURS.frostSoft, 0.55);
    for (let x = -20; x < GAME_WIDTH + 40; x += 46) {
      const h = 70 + ((x * 37) % 50);
      g.fillTriangle(x, HORIZON + 10, x + 26, HORIZON - h, x + 52, HORIZON + 10);
    }

    // Rolling drifts in the foreground, lighter towards the viewer.
    const drifts: Array<[number, number, number, number, number]> = [
      [120, HORIZON + 40, 420, 90, COLOURS.snowDeep],
      [640, HORIZON + 70, 480, 110, COLOURS.snowDeep],
      [60, 1340, 520, 160, COLOURS.snowDeep],
      [720, 1420, 560, 180, COLOURS.snowDeep],
      [380, 1600, 900, 220, COLOURS.ice],
    ];
    for (const [x, y, w, h, c] of drifts) g.fillStyle(c, 1).fillEllipse(x, y, w, h);

    // Packed-snow clearing the furnace stands in.
    g.fillStyle(COLOURS.ice, 1).fillEllipse(FURNACE_X, FURNACE_Y, 560, 150);
    g.lineStyle(4, COLOURS.line, 1).strokeEllipse(FURNACE_X, FURNACE_Y, 560, 150);
  }

  private drawFurnace(): void {
    const x = FURNACE_X;
    const base = FURNACE_Y;
    const w = 300;
    const h = 300;
    const top = base - h;
    const outline = COLOURS.ink;

    // Warm glow pooled on the snow around the furnace.
    const pool = this.add.ellipse(x, base, 520, 130, COLOURS.emberGlow, 0.25);
    this.tweens.add({ targets: pool, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const g = this.add.graphics();
    // Chimney.
    g.fillStyle(COLOURS.slate, 1).fillRect(x + 50, top - 150, 70, 170);
    g.lineStyle(8, outline, 1).strokeRect(x + 50, top - 150, 70, 170);
    g.fillStyle(COLOURS.stone, 1).fillRect(x + 38, top - 168, 94, 30);
    g.strokeRect(x + 38, top - 168, 94, 30);

    // Stone body with a snow cap.
    g.fillStyle(COLOURS.stone, 1).fillRoundedRect(x - w / 2, top, w, h, 36);
    g.lineStyle(8, outline, 1).strokeRoundedRect(x - w / 2, top, w, h, 36);
    g.lineStyle(4, COLOURS.slate, 1);
    for (const ry of [top + 80, top + 160, top + 240]) g.lineBetween(x - w / 2 + 10, ry, x + w / 2 - 10, ry);
    g.fillStyle(COLOURS.ice, 1).fillRoundedRect(x - w / 2 - 10, top - 22, w + 20, 44, 22);
    g.lineStyle(6, outline, 1).strokeRoundedRect(x - w / 2 - 10, top - 22, w + 20, 44, 22);

    // Arched firebox door.
    const dw = 150;
    const dh = 150;
    const dTop = base - dh - 30;
    g.fillStyle(COLOURS.emberDeep, 1);
    g.fillRect(x - dw / 2, dTop + dw / 2, dw, dh - dw / 2);
    g.fillCircle(x, dTop + dw / 2, dw / 2);

    // Flickering fire inside the door.
    const fire = this.add.graphics();
    fire.fillStyle(COLOURS.ember, 1).fillEllipse(0, 0, 120, 120);
    fire.fillStyle(COLOURS.emberGlow, 1).fillEllipse(0, 10, 70, 80);
    fire.setPosition(x, base - 80);
    this.tweens.add({
      targets: fire,
      scaleX: 0.9,
      scaleY: 1.1,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Door frame and grate drawn over the fire.
    const frame = this.add.graphics();
    frame.lineStyle(8, outline, 1);
    frame.beginPath();
    frame.moveTo(x - dw / 2, base - 30);
    frame.lineTo(x - dw / 2, dTop + dw / 2);
    frame.arc(x, dTop + dw / 2, dw / 2, Math.PI, 0, false);
    frame.lineTo(x + dw / 2, base - 30);
    frame.closePath();
    frame.strokePath();
    frame.lineStyle(6, outline, 0.8);
    for (const gx of [-40, 0, 40]) frame.lineBetween(x + gx, dTop + 30, x + gx, base - 30);

    // Embers drifting out of the chimney.
    this.add.particles(x + 85, top - 170, 'ember', {
      speedY: { min: -120, max: -60 },
      speedX: { min: -30, max: 30 },
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: [COLOURS.ember, COLOURS.emberGlow],
      lifespan: 1800,
      frequency: 220,
    });
  }

  private addSnowfall(): void {
    this.add
      .particles(0, -20, 'flake', {
        x: { min: 0, max: GAME_WIDTH },
        speedY: { min: 60, max: 140 },
        speedX: { min: -25, max: 25 },
        scale: { min: 0.3, max: 0.9 },
        alpha: { min: 0.6, max: 1 },
        lifespan: 22000,
        frequency: 90,
        advance: 15000,
      })
      .setDepth(50);
  }
}
