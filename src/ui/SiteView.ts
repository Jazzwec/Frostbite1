import Phaser from 'phaser';
import { buildingName } from '../content';
import { BUILDINGS } from '../engine/balance';
import { buildingCost, fuelCap } from '../engine/economy';
import { SITES, pileSiteIndex } from '../engine/map';
import type { BuildingKey, GameState, Point, StoredResource } from '../engine/types';
import { ORIGIN, toScreen } from '../scenes/coords';
import { COLOURS, CSS, FONT, ROOFS } from '../theme';
import { RESOURCE_LABELS, formatNumber } from './format';

/** Height of a placeholder building's walls above its base line. */
const BODY_H = 120;
const ROOF_H = 50;
const BAR_W = 160;
const BAR_H = 20;
const PILED: StoredResource[] = ['wood', 'food', 'materials'];

/**
 * One building site: an empty plot, a construction site or a placeholder building, with its pile count
 * and a progress bar while it's taking deliveries. The furnace site only shows labels; CityScene draws the furnace.
 */
export class SiteView extends Phaser.GameObjects.Container {
  private readonly siteW: number;
  private readonly isFurnace: boolean;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly barText: Phaser.GameObjects.Text;
  private readonly barPos: Point;
  private sig = '';

  constructor(
    scene: Phaser.Scene,
    private readonly index: number,
  ) {
    const f = SITES[index].footprint;
    const isFurnace = SITES[index].fixed === 'furnace';
    const base = isFurnace ? ORIGIN : toScreen({ x: f.x + f.w / 2, y: f.y + f.h });
    super(scene, base.x, base.y);
    this.siteW = f.w;
    this.isFurnace = isFurnace;
    this.barPos = isFurnace ? { x: -70, y: -370 } : { x: 0, y: -BODY_H - ROOF_H - 30 };

    this.g = scene.add.graphics();
    this.label = scene.add
      .text(0, isFurnace ? -250 : -BODY_H / 2, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: CSS.ice,
        align: 'center',
        wordWrap: { width: isFurnace ? 260 : this.siteW - 12 },
        lineSpacing: 2,
      })
      .setOrigin(0.5);
    this.bar = scene.add.graphics();
    this.barText = scene.add
      .text(this.barPos.x, this.barPos.y - 8, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: CSS.ink,
        backgroundColor: CSS.ice,
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 1);

    this.add([this.g, this.label, this.bar, this.barText]);
    // Furnace labels sit on top of the furnace art; buildings sort with Meagan by their base line.
    this.setDepth(isFurnace ? ORIGIN.y + 1 : base.y);
    scene.add.existing(this);
  }

  /** Screen point above the site, for floating messages. */
  get top(): Point {
    return { x: this.x + this.barPos.x, y: this.y + this.barPos.y - 40 };
  }

  sync(s: GameState): void {
    const site = s.sites[this.index];
    const key = site.building;
    const level = key ? s.buildings[key] : 0;
    const piles = PILED.filter((r) => pileSiteIndex(s, r) === this.index && s.resources[r] >= 1).map(
      (r) => `${formatNumber(s.resources[r])} ${RESOURCE_LABELS[r]}`,
    );
    const fuel = this.isFurnace ? `Fuel ${formatNumber(s.fuel)}/${formatNumber(fuelCap(s))}` : '';
    const progress = PILED.map((r) => Math.floor(site.progress[r] ?? 0));
    const sig = JSON.stringify([key, level, site.upgrading, piles, fuel, progress]);
    if (sig === this.sig) return;
    this.sig = sig;

    this.g.clear();
    if (this.isFurnace) this.label.setText([`Furnace Lv ${level}`, fuel, ...piles].join('\n'));
    else if (!key) this.drawPlot();
    else if (level === 0) this.drawConstruction(key);
    else this.drawBuilding(key, level, piles);

    this.drawProgress(key, level, site.upgrading, site.progress);
  }

  private drawPlot(): void {
    const w = this.siteW;
    this.g.fillStyle(COLOURS.ice, 0.7).fillRoundedRect(-w / 2, -60, w, 60, 14);
    this.g.lineStyle(4, COLOURS.line, 1).strokeRoundedRect(-w / 2, -60, w, 60, 14);
    this.g.lineStyle(6, COLOURS.slate, 0.7).lineBetween(-14, -30, 14, -30).lineBetween(0, -44, 0, -16);
    this.label.setText('').setColor(CSS.ink);
  }

  private drawConstruction(key: BuildingKey): void {
    const w = this.siteW;
    const g = this.g;
    g.fillStyle(COLOURS.snowDeep, 1).fillRoundedRect(-w / 2, -60, w, 60, 10);
    g.lineStyle(7, COLOURS.timber, 1);
    for (const x of [-w / 2 + 10, w / 2 - 10]) g.lineBetween(x, 0, x, -BODY_H);
    for (const y of [-40, -BODY_H + 10]) g.lineBetween(-w / 2 + 4, y, w / 2 - 4, y);
    g.lineStyle(5, COLOURS.timber, 0.8).lineBetween(-w / 2 + 10, -40, w / 2 - 10, -BODY_H + 10);
    this.label.setText(buildingName(key)).setColor(CSS.ink).setY(-BODY_H / 2 - 10);
  }

  private drawBuilding(key: BuildingKey, level: number, piles: string[]): void {
    const w = this.siteW;
    const g = this.g;
    const roof = ROOFS[Object.keys(BUILDINGS).indexOf(key) % ROOFS.length];
    g.fillStyle(COLOURS.stone, 1).fillRoundedRect(-w / 2, -BODY_H, w, BODY_H, 10);
    g.lineStyle(5, COLOURS.ink, 1).strokeRoundedRect(-w / 2, -BODY_H, w, BODY_H, 10);
    g.fillStyle(roof, 1).fillTriangle(-w / 2 - 10, -BODY_H + 6, 0, -BODY_H - ROOF_H, w / 2 + 10, -BODY_H + 6);
    g.lineStyle(5, COLOURS.ink, 1).strokeTriangle(-w / 2 - 10, -BODY_H + 6, 0, -BODY_H - ROOF_H, w / 2 + 10, -BODY_H + 6);
    g.fillStyle(COLOURS.ice, 1).fillTriangle(-24, -BODY_H - ROOF_H + 24, 0, -BODY_H - ROOF_H, 24, -BODY_H - ROOF_H + 24);
    this.label.setText([buildingName(key), `Lv ${level}`, ...piles].join('\n')).setColor(CSS.ice).setY(-BODY_H / 2);
  }

  private drawProgress(
    key: BuildingKey | null,
    level: number,
    upgrading: boolean,
    progress: Partial<Record<StoredResource, number>>,
  ): void {
    this.bar.clear();
    if (!key || !upgrading) {
      this.barText.setVisible(false);
      return;
    }
    const cost = buildingCost(key, level) as Partial<Record<StoredResource, number>>;
    let have = 0;
    let need = 0;
    const parts: string[] = [];
    for (const [r, v] of Object.entries(cost) as Array<[StoredResource, number]>) {
      const got = Math.min(v, progress[r] ?? 0);
      have += got;
      need += v;
      parts.push(`${formatNumber(got)}/${formatNumber(v)} ${RESOURCE_LABELS[r]}`);
    }
    const { x, y } = this.barPos;
    const frac = need > 0 ? have / need : 1;
    this.bar.fillStyle(COLOURS.ice, 1).fillRoundedRect(x - BAR_W / 2, y, BAR_W, BAR_H, 8);
    this.bar.lineStyle(4, COLOURS.ink, 1).strokeRoundedRect(x - BAR_W / 2, y, BAR_W, BAR_H, 8);
    const fillW = (BAR_W - 6) * frac;
    if (fillW > 0) this.bar.fillStyle(COLOURS.ember, 1).fillRoundedRect(x - BAR_W / 2 + 3, y + 3, fillW, BAR_H - 6, Math.min(5, fillW / 2));
    this.barText.setText(parts.join(' · ')).setVisible(true);
  }
}
