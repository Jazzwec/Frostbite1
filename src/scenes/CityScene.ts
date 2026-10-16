import Phaser from 'phaser';
import { buildingName } from '../content';
import { CARAVAN, MEAGAN } from '../engine/balance';
import { buildingCost, carryLimit, heatCap } from '../engine/economy';
import { CARAVAN_SPOTS, FOREST, HUNTING_GROUNDS, MEAGAN_START, SCRAP_HEAP, SITES, distance, jobSite } from '../engine/map';
import { findPath } from '../engine/pathfinding';
import type { EngineEvent, GameState, Jan, Point, Rect } from '../engine/types';
import { devFlags, engine, saveNow } from '../game/runtime';
import { COLOURS, CSS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../theme';
import { BuildPicker } from '../ui/BuildPicker';
import { AnimalSprite } from '../ui/AnimalSprite';
import { JOB_LABELS, formatClock, formatCost, formatNumber } from '../ui/format';
import { HeatBar } from '../ui/HeatBar';
import { JanSprite } from '../ui/JanSprite';
import { MeaganSprite } from '../ui/MeaganSprite';
import { SiteView } from '../ui/SiteView';
import { ORIGIN, toScreen, toWorld } from './coords';

/** Where the sky meets the snow: just above the top of the walkable map. */
const HORIZON = ORIGIN.y - 420;
const FURNACE_X = ORIGIN.x;
const FURNACE_Y = ORIGIN.y; // base of the furnace

/** Tapping within this many map units of a gathering spot walks her right onto it. */
const GATHER_TAP_RADIUS = 100;
/** Tap radius around a frozen Jan's body (≥ 44 pt on the phone). */
const FROZEN_TAP_RADIUS = 55;
/** Jans sharing a job stand in a little group around its work spot. */
const CROWD = { perRow: 4, dx: 26, dy: 24 } as const;

/** Draw order: background < world (sorted by screen y) < snowfall < debug < HUD < menus. */
const DEPTH = { background: -10000, snowfall: 5000, debug: 9000, hud: 10000 } as const;

export class CityScene extends Phaser.Scene {
  heatBar!: HeatBar;
  private meagan!: MeaganSprite;
  private sites: SiteView[] = [];
  private picker!: BuildPicker;
  private debug!: Phaser.GameObjects.Graphics;
  private readonly frozen = new Map<number, JanSprite>();
  private readonly jans = new Map<number, JanSprite>();
  private readonly animals = new Map<number, AnimalSprite>();
  /** Where a just-thawed Jan starts walking from (map units), keyed by Jan id. */
  private readonly thawedAt = new Map<number, Point>();
  /** engine.loadCount when this scene was built; a different value means a save was loaded. */
  private builtFor = 0;

  constructor() {
    super('City');
  }

  create(): void {
    // create() runs again on restart, so start from empty sprite maps.
    this.frozen.clear();
    this.jans.clear();
    this.animals.clear();
    this.thawedAt.clear();
    this.builtFor = engine.loadCount;
    this.makeTextures();
    this.drawBackground();
    this.drawGatherSpots();
    this.drawFurnace();
    this.addSnowfall();

    this.sites = SITES.map((_, i) => new SiteView(this, i));
    this.meagan = new MeaganSprite(this, toScreen(engine.state.meagan));
    this.picker = new BuildPicker(this, engine);
    this.debug = this.add.graphics().setDepth(DEPTH.debug);

    this.heatBar = new HeatBar(this, 48, 36, GAME_WIDTH - 96);
    this.heatBar.setDepth(DEPTH.hud);
    this.syncHeat();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.onTap(toWorld({ x: p.worldX, y: p.worldY }));
    });
  }

  update(_time: number, delta: number): void {
    if (engine.loadCount !== this.builtFor) {
      this.scene.restart(); // a different city was loaded: rebuild every sprite from the new state
      return;
    }
    engine.advance(delta);
    for (const e of engine.drainEvents()) this.onEvent(e);

    const s = engine.state;
    this.syncHeat();
    for (const v of this.sites) v.sync(s);
    this.meagan.follow(toScreen(s.meagan), s.meagan.path.length > 0, delta);
    this.meagan.setBag(s.meagan.bag, carryLimit(s));
    this.meagan.setHealth(s.meagan.hp / MEAGAN.hp, s.meagan.injured);
    this.syncJans(s, delta);
    this.syncAnimals(s, delta);
    this.drawDebug();
  }

  /** A tap on open map: a site walks her there to act, the gathering spots walk her onto them, anywhere else just walks. */
  private onTap(p: Point): void {
    const frozen = engine.state.waiting.find((w) => distance({ x: w.x, y: w.y - 50 }, p) <= FROZEN_TAP_RADIUS);
    if (frozen) {
      if (engine.tapArrival(frozen.id)) this.tapMarker(frozen);
      return;
    }
    const site = SITES.findIndex((_, i) => contains(hitRect(i), p));
    if (site >= 0) {
      if (engine.tapSite(site)) this.tapMarker(SITES[site].drop);
      return;
    }
    const spot = [FOREST, HUNTING_GROUNDS, SCRAP_HEAP].find((g) => distance(g, p) <= GATHER_TAP_RADIUS);
    if (engine.walkTo(spot ?? p)) this.tapMarker(engine.state.meagan.path.at(-1)!);
  }

  private onEvent(e: EngineEvent): void {
    if (e.type === 'plotReached') this.picker.open(e.site);
    else if (e.type === 'rescued') {
      this.thawedAt.set(e.jan.id, e.from);
      this.floater(above(e.from), `Jan thawed! → ${JOB_LABELS[e.jan.job]}`);
    } else if (e.type === 'rescueBlocked') {
      const w = engine.state.waiting.find((a) => a.id === e.id);
      if (w) this.floater(above(w), 'No room!\nUpgrade the Furnace or build a Bunkhouse');
    } else if (e.type === 'caravan') this.floater(above(CARAVAN_SPOTS[3]), `A caravan of ${e.count} Jans arrived!`);
    else if (e.type === 'attackWarn') this.notice(`Animals spotted! Here in ${formatClock(e.startsIn)}`);
    else if (e.type === 'attackStart') this.notice(`${e.animals} animals are coming for the furnace!`);
    else if (e.type === 'attackEnd') this.notice(e.repelled ? 'The animals ran off. Well defended!' : 'The animals got away with some supplies.');
    else if (e.type === 'animalKilled') this.floater(above(e.at), `+${formatNumber(e.food)} Food · +${formatNumber(e.materials)} Mat`);
    else if (e.type === 'janScared') this.floater(above(e.at), 'A Jan ran off for good!');
    else if (e.type === 'meaganInjured') this.floater(above(engine.state.meagan), 'Ouch! Meagan needs a rest');
    else if (e.type === 'furnaceHit') {
      const lost = [`−${formatNumber(e.wood)} Wood`, `−${formatNumber(e.food)} Food`, e.jansLost > 0 ? `${e.jansLost} Jan${e.jansLost > 1 ? 's' : ''} fled` : ''];
      this.floater(this.sites[0].top, `Raided! ${lost.filter(Boolean).join(' · ')}`);
    }
    else if (e.type === 'upgradeStarted') {
      const cost = buildingCost(e.building, engine.state.buildings[e.building]);
      this.floater(this.sites[e.site].top, `Bring ${formatCost(cost)}`);
      saveNow();
    } else if (e.type === 'buildingUpgraded') {
      saveNow();
      const name = buildingName(e.building);
      this.floater(this.sites[e.site].top, e.level === 1 ? `${name} built!` : `${name} Lv ${e.level}!`);
    }
  }

  private syncHeat(): void {
    this.heatBar.setValue(engine.state.heat / heatCap(engine.state));
  }

  /** A message near the top of the map, for city-wide news. */
  private notice(text: string): void {
    this.floater({ x: GAME_WIDTH / 2, y: 330 }, text);
  }

  private tapMarker(at: Point): void {
    const p = toScreen(at);
    const ring = this.add.ellipse(p.x, p.y, 70, 24).setStrokeStyle(4, COLOURS.frost, 1).setDepth(p.y - 1);
    this.tweens.add({ targets: ring, scaleX: 0.4, scaleY: 0.4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }

  private floater(at: Point, text: string): void {
    const t = this.add
      .text(at.x, at.y, text, {
        fontFamily: FONT,
        fontSize: '28px',
        color: CSS.ink,
        backgroundColor: CSS.ice,
        padding: { x: 10, y: 4 },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.hud - 1);
    // Keep it on screen near the edges.
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 8, GAME_WIDTH - t.width / 2 - 8);
    this.tweens.add({ targets: t, y: at.y - 60, alpha: 0, delay: 1200, duration: 700, onComplete: () => t.destroy() });
  }

  /** Frozen Jans wait at the edge; thawed Jans walk to their job's spot and work there. */
  private syncJans(s: GameState, delta: number): void {
    const waiting = new Set(s.waiting.map((w) => w.id));
    for (const [id, sprite] of this.frozen) {
      if (!waiting.has(id)) {
        sprite.destroy();
        this.frozen.delete(id);
      }
    }
    for (const w of s.waiting) {
      let sprite = this.frozen.get(w.id);
      if (!sprite) this.frozen.set(w.id, (sprite = new JanSprite(this, toScreen(w), true)));
      sprite.setTimer(w.leavesAt === null ? null : (w.leavesAt - s.t) / CARAVAN.waitSeconds);
    }

    const present = new Set(s.jans.map((j) => j.id));
    for (const [id, sprite] of this.jans) {
      if (!present.has(id)) {
        sprite.destroy();
        this.jans.delete(id);
      }
    }
    const crowd = new Map<string, number>();
    for (const jan of [...s.jans].sort((a, b) => a.id - b.id)) {
      const k = crowd.get(jan.job) ?? 0;
      crowd.set(jan.job, k + 1);
      const spot = workSpot(s, jan, k);
      let sprite = this.jans.get(jan.id);
      if (!sprite) {
        const from = this.thawedAt.get(jan.id) ?? spot;
        this.thawedAt.delete(jan.id);
        this.jans.set(jan.id, (sprite = new JanSprite(this, toScreen(from), false)));
      }
      // In a fight, guards follow their combat units instead of standing at their spot.
      const unit = jan.job === 'guard' && s.attack.active ? s.attack.guards.find((g) => g.janId === jan.id) : undefined;
      sprite.setKnockedOut(unit?.knockedOut ?? false);
      if (unit) {
        sprite.target = null;
        sprite.walk([toScreen(unit)]);
        sprite.tick(delta);
        continue;
      }
      if (!sprite.target || sprite.target.x !== spot.x || sprite.target.y !== spot.y) {
        sprite.target = spot;
        sprite.walk(findPath(engine.nav, toWorld(sprite), spot).map(toScreen));
      }
      sprite.tick(delta);
    }
  }

  /** Animals in an attack, with HP bars. */
  private syncAnimals(s: GameState, delta: number): void {
    const alive = new Set(s.attack.animals.map((a) => a.id));
    for (const [id, sprite] of this.animals) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.animals.delete(id);
      }
    }
    for (const a of s.attack.animals) {
      let sprite = this.animals.get(a.id);
      if (!sprite) this.animals.set(a.id, (sprite = new AnimalSprite(this, toScreen(a), a.kind)));
      sprite.follow(toScreen(a), delta);
      sprite.setHealth(a.hp / a.maxHp);
    }
  }

  /** Dev only: frostbite.debugPath = true shows blocked cells and her current path. */
  private drawDebug(): void {
    this.debug.clear();
    if (!devFlags.debugPath) return;
    const nav = engine.nav;
    this.debug.fillStyle(COLOURS.danger, 0.25);
    for (let i = 0; i < nav.walkable.length; i++) {
      if (nav.walkable[i]) continue;
      const p = toScreen({
        x: nav.bounds.minX + (i % nav.cols) * nav.cellSize,
        y: nav.bounds.minY + Math.floor(i / nav.cols) * nav.cellSize,
      });
      this.debug.fillRect(p.x, p.y, nav.cellSize, nav.cellSize);
    }
    const m = engine.state.meagan;
    if (m.path.length === 0) return;
    this.debug.lineStyle(4, COLOURS.danger, 1).beginPath();
    const start = toScreen(m);
    this.debug.moveTo(start.x, start.y);
    for (const w of m.path) {
      const q = toScreen(w);
      this.debug.lineTo(q.x, q.y);
    }
    this.debug.strokePath();
    for (const w of m.path) {
      const q = toScreen(w);
      this.debug.fillStyle(COLOURS.danger, 1).fillCircle(q.x, q.y, 6);
    }
  }

  /** Small runtime textures for particles, so there are no image assets yet. */
  private makeTextures(): void {
    if (this.textures.exists('flake')) return; // already made before a restart
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture('flake', 16, 16);
    g.clear();
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
    g.generateTexture('ember', 12, 12);
    g.destroy();
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(DEPTH.background);
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

  /** Placeholder forest (Wood), hunting grounds (Food) and scrap heap (Materials) where Meagan gathers by hand. */
  private drawGatherSpots(): void {
    const forest = toScreen(FOREST);
    const trees: Array<[number, number, number]> = [
      [-50, -50, 1],
      [10, -70, 1.15],
      [55, -40, 0.9],
      [-30, -10, 0.8],
    ];
    for (const [dx, dy, k] of trees) {
      const x = forest.x + dx;
      const base = forest.y + dy;
      const g = this.add.graphics().setDepth(base);
      g.fillStyle(COLOURS.timber, 1).fillRect(x - 6 * k, base - 14 * k, 12 * k, 14 * k);
      g.fillStyle(COLOURS.pine, 1).fillTriangle(x - 34 * k, base - 12 * k, x, base - 110 * k, x + 34 * k, base - 12 * k);
      g.fillStyle(COLOURS.ice, 1).fillTriangle(x - 12 * k, base - 80 * k, x, base - 110 * k, x + 12 * k, base - 80 * k);
      g.lineStyle(4, COLOURS.ink, 1).strokeTriangle(x - 34 * k, base - 12 * k, x, base - 110 * k, x + 34 * k, base - 12 * k);
    }
    this.add.ellipse(forest.x, forest.y, 120, 34, COLOURS.snowDeep, 1).setDepth(DEPTH.background + 1);

    const hunt = toScreen(HUNTING_GROUNDS);
    const g = this.add.graphics().setDepth(DEPTH.background + 1);
    g.fillStyle(COLOURS.snowDeep, 1).fillEllipse(hunt.x, hunt.y, 150, 50);
    // Paw prints crossing the clearing.
    g.fillStyle(COLOURS.slate, 0.45);
    for (let i = 0; i < 5; i++) g.fillCircle(hunt.x - 60 + i * 28, hunt.y - 8 + (i % 2) * 14, 5);
    const bushes = this.add.graphics().setDepth(hunt.y - 40);
    for (const [dx, dy] of [
      [-40, -40],
      [30, -55],
    ]) {
      bushes.fillStyle(COLOURS.pine, 1).fillEllipse(hunt.x + dx, hunt.y + dy, 60, 40);
      bushes.lineStyle(4, COLOURS.ink, 1).strokeEllipse(hunt.x + dx, hunt.y + dy, 60, 40);
      bushes.fillStyle(COLOURS.ember, 1).fillCircle(hunt.x + dx - 10, hunt.y + dy - 4, 4).fillCircle(hunt.x + dx + 8, hunt.y + dy + 4, 4);
    }

    // A wrecked sled with spilled crates.
    const scrap = toScreen(SCRAP_HEAP);
    this.add.ellipse(scrap.x, scrap.y, 140, 40, COLOURS.snowDeep, 1).setDepth(DEPTH.background + 1);
    const wreck = this.add.graphics().setDepth(scrap.y - 10);
    wreck.lineStyle(6, COLOURS.slate, 1).lineBetween(scrap.x - 60, scrap.y - 10, scrap.x + 10, scrap.y - 22);
    wreck.lineStyle(6, COLOURS.slate, 1).lineBetween(scrap.x - 55, scrap.y - 2, scrap.x + 15, scrap.y - 14);
    wreck.fillStyle(COLOURS.timber, 1).fillRect(scrap.x - 50, scrap.y - 44, 52, 22);
    wreck.lineStyle(4, COLOURS.ink, 1).strokeRect(scrap.x - 50, scrap.y - 44, 52, 22);
    for (const [dx, dy, size] of [
      [22, -40, 34],
      [44, -24, 26],
    ]) {
      wreck.fillStyle(COLOURS.timber, 1).fillRect(scrap.x + dx, scrap.y + dy, size, size);
      wreck.lineStyle(4, COLOURS.ink, 1).strokeRect(scrap.x + dx, scrap.y + dy, size, size);
      wreck.lineBetween(scrap.x + dx, scrap.y + dy, scrap.x + dx + size, scrap.y + dy + size);
    }

    const label = { fontFamily: FONT, fontSize: '22px', color: CSS.slate };
    this.add.text(forest.x, forest.y + 22, 'Forest', label).setOrigin(0.5, 0).setDepth(DEPTH.background + 2);
    this.add.text(hunt.x, hunt.y + 22, 'Hunting', label).setOrigin(0.5, 0).setDepth(DEPTH.background + 2);
    this.add.text(scrap.x, scrap.y + 18, 'Scrap', label).setOrigin(0.5, 0).setDepth(DEPTH.background + 2);
  }

  private drawFurnace(): void {
    const x = FURNACE_X;
    const base = FURNACE_Y;
    const w = 300;
    const h = 300;
    const top = base - h;
    const outline = COLOURS.ink;

    // Warm glow pooled on the snow around the furnace.
    const pool = this.add.ellipse(x, base, 520, 130, COLOURS.emberGlow, 0.25).setDepth(DEPTH.background + 1);
    this.tweens.add({ targets: pool, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const g = this.add.graphics().setDepth(base);
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
    const fire = this.add.graphics().setDepth(base);
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
    const frame = this.add.graphics().setDepth(base);
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
    this.add
      .particles(x + 85, top - 170, 'ember', {
        speedY: { min: -120, max: -60 },
        speedX: { min: -30, max: 30 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 1, end: 0 },
        tint: [COLOURS.ember, COLOURS.emberGlow],
        lifespan: 1800,
        frequency: 220,
      })
      .setDepth(base);
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
      .setDepth(DEPTH.snowfall);
  }
}

/** Generous tap area for a site in map units: the building's drawn shape plus margin (≥ 44 pt on the phone). */
function hitRect(i: number): Rect {
  const f = SITES[i].footprint;
  if (SITES[i].fixed === 'furnace') return { x: -170, y: -330, w: 340, h: 360 };
  return { x: f.x - 10, y: f.y - 120, w: f.w + 20, h: f.h + 150 };
}

/** Where the k-th Jan on a job stands: grouped around the job's spot, or by the furnace when it has none. */
function workSpot(s: GameState, jan: Jan, k: number): Point {
  const base = (jan.job !== 'idle' && jobSite(s, jan.job)) || { x: MEAGAN_START.x + 90, y: MEAGAN_START.y + 30 };
  return { x: base.x + ((k % CROWD.perRow) - (CROWD.perRow - 1) / 2) * CROWD.dx, y: base.y + Math.floor(k / CROWD.perRow) * CROWD.dy };
}

/** Screen point above a figure standing at a map point, for floating messages. */
function above(p: Point): Point {
  const q = toScreen(p);
  return { x: q.x, y: q.y - 150 };
}

function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
