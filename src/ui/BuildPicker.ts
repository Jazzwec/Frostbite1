import Phaser from 'phaser';
import { buildingName } from '../content';
import { BUILDINGS } from '../engine/balance';
import { isUnlocked, nextCost } from '../engine/economy';
import type { GameEngine } from '../engine/GameEngine';
import { siteIndexOf } from '../engine/map';
import type { BuildingKey } from '../engine/types';
import { COLOURS, CSS, FONT, GAME_HEIGHT, GAME_WIDTH, TAB_BAR_HEIGHT } from '../theme';
import { formatCost } from './format';

const PAD = 24;
const COLS = 2;
const BTN_H = 112;
const GAP = 14;
const HEADER_H = 96;
/** Ignore taps this soon after opening, so the finger that sent her to the plot can't close the sheet. */
const OPEN_GRACE_MS = 300;

/** Bottom sheet that opens when Meagan reaches an empty plot: pick what to build there. */
export class BuildPicker extends Phaser.GameObjects.Container {
  private site = -1;
  private openedAt = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly engine: GameEngine,
  ) {
    super(scene, 0, 0);
    this.setDepth(20000).setVisible(false);
    scene.add.existing(this);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  open(site: number): void {
    this.site = site;
    this.openedAt = this.scene.time.now;
    this.removeAll(true);
    const s = this.engine.state;
    // Placed buildings are hidden; locked ones stay visible so she can see what's coming.
    const keys = (Object.keys(BUILDINGS) as BuildingKey[]).filter((k) => siteIndexOf(s, k) < 0);
    const rows = Math.ceil(keys.length / COLS);
    const panelH = HEADER_H + rows * (BTN_H + GAP) + PAD;
    const top = GAME_HEIGHT - TAB_BAR_HEIGHT - panelH; // sits above the HTML tab bar

    // Tapping the dimmed backdrop closes the sheet (and swallows the tap so she doesn't walk).
    const backdrop = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOURS.ink, 0.35).setOrigin(0);
    backdrop.setInteractive().on('pointerup', () => this.ready() && this.close());

    const panel = this.scene.add.graphics();
    panel.fillStyle(COLOURS.ice, 1).fillRoundedRect(0, top, GAME_WIDTH, panelH + 40, 32);
    panel.lineStyle(5, COLOURS.line, 1).strokeRoundedRect(0, top, GAME_WIDTH, panelH + 40, 32);
    // The panel itself eats taps that miss a button.
    const panelHit = this.scene.add.zone(0, top, GAME_WIDTH, panelH).setOrigin(0).setInteractive();

    const title = this.scene.add.text(PAD, top + 28, 'Build here', { fontFamily: FONT, fontSize: '36px', color: CSS.ink });
    const closeBtn = this.scene.add
      .text(GAME_WIDTH - PAD, top + 22, '✕', { fontFamily: FONT, fontSize: '40px', color: CSS.slate, padding: { x: 14, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive()
      .on('pointerup', () => this.ready() && this.close());

    this.add([backdrop, panel, panelHit, title, closeBtn]);

    const btnW = (GAME_WIDTH - PAD * 2 - GAP * (COLS - 1)) / COLS;
    keys.forEach((key, i) => {
      const x = PAD + (i % COLS) * (btnW + GAP);
      const y = top + HEADER_H + Math.floor(i / COLS) * (BTN_H + GAP);
      this.add(this.button(key, x, y, btnW));
    });
    // A screen-fixed sheet: it stays put however the camera has scrolled.
    this.setScrollFactor(0, 0, true).setVisible(true);
  }

  close(): void {
    this.setVisible(false);
    this.removeAll(true);
    this.site = -1;
  }

  private ready(): boolean {
    return this.scene.time.now - this.openedAt >= OPEN_GRACE_MS;
  }

  private button(key: BuildingKey, x: number, y: number, w: number): Phaser.GameObjects.GameObject[] {
    const s = this.engine.state;
    const unlocked = isUnlocked(s, key);
    const bg = this.scene.add.graphics();
    bg.fillStyle(unlocked ? COLOURS.snow : COLOURS.snowDeep, 1).fillRoundedRect(x, y, w, BTN_H, 18);
    bg.lineStyle(4, unlocked ? COLOURS.ink : COLOURS.line, 1).strokeRoundedRect(x, y, w, BTN_H, 18);
    const name = this.scene.add.text(x + 18, y + 16, buildingName(key), {
      fontFamily: FONT,
      fontSize: '28px',
      color: unlocked ? CSS.ink : CSS.slate,
    });
    const detail = unlocked ? formatCost(nextCost(s, key)) : `Furnace Lv ${BUILDINGS[key].unlockFurnace}`;
    const sub = this.scene.add.text(x + 18, y + 62, detail, {
      fontFamily: FONT,
      fontSize: '24px',
      color: unlocked ? CSS.ember : CSS.slate,
    });
    const hit = this.scene.add.zone(x, y, w, BTN_H).setOrigin(0).setInteractive();
    hit.on('pointerup', () => {
      if (this.ready() && unlocked && this.engine.chooseBuilding(this.site, key)) this.close();
    });
    return [bg, name, sub, hit];
  }
}
