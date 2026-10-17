import Phaser from 'phaser';
import { NODES } from '../engine/balance';
import { RESOURCE_NODES } from '../engine/map';
import type { NodeKind } from '../engine/types';
import { toScreen } from '../scenes/coords';
import { COLOURS, CSS, FONT } from '../theme';
import { artImage, hasArt } from './art';
import { formatNumber } from './format';

/** Below the trees and figures, above the background. */
const GROUND_DEPTH = -9990;
/** Trees in a forest, as offsets from its spot with a size factor; the later ones vanish first as it runs low. */
const TREES: Array<[number, number, number]> = [
  [15, -70, 1.15],
  [-55, -45, 1],
  [60, -35, 0.9],
  [-30, -5, 0.8],
  [45, 12, 0.85],
];
const BUSHES: Array<[number, number]> = [
  [-40, -40],
  [30, -55],
  [-5, -70],
];
/** Height of a generated pine at size 1, and width of the scrap heap art at full stock. */
const PINE_ART_HEIGHT = 125;
const SCRAP_ART_WIDTH = 150;
const LABEL: Record<NodeKind, string> = { forest: 'Wood', hunting: 'Food', scrap: 'Mat' };

/** One resource spot: a forest, hunting ground or scrap heap that visibly runs low and grows back. */
export class NodeView {
  private readonly kind: NodeKind;
  private readonly ground: Phaser.GameObjects.Ellipse;
  /** Pieces that disappear one by one as stock runs out (trees, bushes). */
  private readonly pieces: Phaser.GameObjects.Components.Visible[] = [];
  /** The scrap heap shrinks instead, from the scale it was created at. */
  private heap: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | null = null;
  private heapScale = 1;
  private readonly tag: Phaser.GameObjects.Text;
  private shown = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    index: number,
  ) {
    const node = RESOURCE_NODES[index];
    this.kind = node.kind;
    const p = toScreen(node.at);
    this.ground = scene.add.ellipse(p.x, p.y, node.kind === 'forest' ? 170 : 150, 46, COLOURS.snowDeep, 1).setDepth(GROUND_DEPTH);

    if (node.kind === 'forest') {
      for (const [dx, dy, k] of TREES) {
        const x = p.x + dx;
        const base = p.y + dy;
        // A stump stays behind when the tree above it is gone.
        scene.add.ellipse(x, base - 4, 22 * k, 10 * k, COLOURS.timber, 1).setDepth(GROUND_DEPTH + 1);
        this.pieces.push(this.tree(x, base, k));
      }
    } else if (node.kind === 'hunting') {
      const prints = scene.add.graphics().setDepth(GROUND_DEPTH + 1);
      prints.fillStyle(COLOURS.slate, 0.45);
      for (let i = 0; i < 5; i++) prints.fillCircle(p.x - 60 + i * 28, p.y - 8 + (i % 2) * 14, 5);
      for (const [dx, dy] of BUSHES) {
        const bush = scene.add.graphics().setDepth(p.y + dy);
        bush.fillStyle(COLOURS.pine, 1).fillEllipse(p.x + dx, p.y + dy, 60, 40);
        bush.lineStyle(4, COLOURS.ink, 1).strokeEllipse(p.x + dx, p.y + dy, 60, 40);
        bush.fillStyle(COLOURS.ember, 1).fillCircle(p.x + dx - 10, p.y + dy - 4, 4).fillCircle(p.x + dx + 8, p.y + dy + 4, 4);
        this.pieces.push(bush);
      }
    } else {
      this.heap = hasArt(scene, 'scrap')
        ? artImage(scene, 'scrap', p.x, p.y + 6, { width: SCRAP_ART_WIDTH }).setDepth(p.y - 10)
        : this.drawnWreck(p.x, p.y);
      this.heapScale = this.heap.scaleX;
    }

    this.tag = scene.add
      .text(p.x, p.y + 26, '', { fontFamily: FONT, fontSize: '20px', color: CSS.ink, backgroundColor: CSS.ice, padding: { x: 6, y: 2 } })
      .setOrigin(0.5, 0)
      .setDepth(GROUND_DEPTH + 2);
  }

  /** Show the spot's current stock: pieces vanish (or the heap shrinks) as it runs low; empty spots grey out. */
  sync(stock: number): void {
    const n = Math.floor(stock);
    if (n === this.shown) return;
    this.shown = n;
    const full = NODES[this.kind].stock;
    const frac = Math.max(0, Math.min(1, stock / full));
    const empty = n <= 0;
    this.pieces.forEach((piece, i) => piece.setVisible(frac > i / this.pieces.length));
    if (this.heap) this.heap.setScale(this.heapScale * (0.55 + 0.45 * frac)).setAlpha(empty ? 0.45 : 1);
    this.ground.setFillStyle(empty ? COLOURS.line : COLOURS.snowDeep, 1);
    this.tag.setText(empty ? 'Regrowing…' : `${formatNumber(n)} ${LABEL[this.kind]}`);
  }

  private tree(x: number, base: number, k: number): Phaser.GameObjects.Components.Visible {
    if (hasArt(this.scene, 'pine')) return artImage(this.scene, 'pine', x, base, { height: PINE_ART_HEIGHT * k }).setDepth(base);
    const g = this.scene.add.graphics().setDepth(base);
    g.fillStyle(COLOURS.timber, 1).fillRect(x - 6 * k, base - 14 * k, 12 * k, 14 * k);
    g.fillStyle(COLOURS.pine, 1).fillTriangle(x - 34 * k, base - 12 * k, x, base - 110 * k, x + 34 * k, base - 12 * k);
    g.fillStyle(COLOURS.ice, 1).fillTriangle(x - 12 * k, base - 80 * k, x, base - 110 * k, x + 12 * k, base - 80 * k);
    g.lineStyle(4, COLOURS.ink, 1).strokeTriangle(x - 34 * k, base - 12 * k, x, base - 110 * k, x + 34 * k, base - 12 * k);
    return g;
  }

  /** Placeholder wreck (a broken sled and crates) drawn around (0, 0) so it can scale about the spot. */
  private drawnWreck(x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics({ x, y }).setDepth(y - 10);
    g.lineStyle(6, COLOURS.slate, 1).lineBetween(-60, -10, 10, -22).lineBetween(-55, -2, 15, -14);
    g.fillStyle(COLOURS.timber, 1).fillRect(-50, -44, 52, 22);
    g.lineStyle(4, COLOURS.ink, 1).strokeRect(-50, -44, 52, 22);
    for (const [dx, dy, size] of [
      [22, -40, 34],
      [44, -24, 26],
    ]) {
      g.fillStyle(COLOURS.timber, 1).fillRect(dx, dy, size, size);
      g.lineStyle(4, COLOURS.ink, 1).strokeRect(dx, dy, size, size);
      g.lineBetween(dx, dy, dx + size, dy + size);
    }
    return g;
  }
}
