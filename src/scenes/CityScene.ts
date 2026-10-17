import Phaser from 'phaser';
import { buildingName, chatterLine, rescueLine } from '../content';
import { MEAGAN } from '../engine/balance';
import { bagTotal, carryLimit, caravanWait, heatCap, nextCost, tierOf } from '../engine/economy';
import { MEAGAN_START, RESOURCE_NODES, SITES, distance, jobSite } from '../engine/map';
import { findPath } from '../engine/pathfinding';
import type { EngineEvent, GameState, Jan, Point, Rect } from '../engine/types';
import { bus } from '../game/bus';
import { devFlags, engine, saveNow } from '../game/runtime';
import { sfx } from '../game/sound';
import { COLOURS, CSS, FONT, GAME_HEIGHT, GAME_WIDTH, TAB_BAR_HEIGHT } from '../theme';
import { BuildPicker } from '../ui/BuildPicker';
import { AnimalSprite } from '../ui/AnimalSprite';
import { artImage, hasArt, preloadArt, trimArt } from '../ui/art';
import { JOB_LABELS, formatCost, formatNumber } from '../ui/format';
import { HeatBar } from '../ui/HeatBar';
import { JanSprite } from '../ui/JanSprite';
import { MeaganSprite } from '../ui/MeaganSprite';
import { NodeView } from '../ui/NodeView';
import { SiteView } from '../ui/SiteView';
import { ORIGIN, SKY_H, WORLD_H, WORLD_W, toScreen, toWorld } from './coords';

/** Where the sky meets the snow: just above the top of the walkable map. */
const HORIZON = SKY_H - 20;
const FURNACE_X = ORIGIN.x;
const FURNACE_Y = ORIGIN.y; // base of the furnace

/** Tapping within this many map units of a resource spot walks her right onto it. */
const GATHER_TAP_RADIUS = 100;
/** A press that moves further than this (screen px) is a drag that pans the camera, not a tap. */
const DRAG_THRESHOLD = 14;
/** After a drag, the camera goes back to following Meagan this long after the last move, or when she's sent somewhere. */
const FOLLOW_RESUME_MS = 4000;
/** Camera smoothing, and how far above her feet it centres (so her whole body sits mid-screen). */
const FOLLOW_LERP = 0.1;
const FOLLOW_OFFSET_Y = 60;
/** Off-screen frozen Jans get an arrow at the screen edge, kept clear of the heat bar, strip and tab bar. */
const EDGE_ARROW_INSET = { side: 44, top: 260, bottom: TAB_BAR_HEIGHT + 44 };
/** Tap radius around a frozen Jan's body (≥ 44 pt on the phone). */
const FROZEN_TAP_RADIUS = 55;
/** Idle chatter: one line over a random working Jan every 20–30 s while the city is calm (brief). */
const CHATTER_MIN_MS = 20_000;
const CHATTER_MAX_MS = 30_000;
/** A pick-up or delivery plink once this much has moved in or out of her bag, at most this often. */
const BAG_SOUND_UNITS = 2;
const BAG_SOUND_GAP_MS = 120;
/** Furnace looks by heat: 0 = cold, then up to 4 = roaring (fire size, glow size, ember rate in ms). */
const HEAT_STAGES = [
  { fire: 0, glow: 0, embers: 0 },
  { fire: 0.45, glow: 0.55, embers: 700 },
  { fire: 0.65, glow: 0.75, embers: 450 },
  { fire: 0.85, glow: 0.9, embers: 300 },
  { fire: 1, glow: 1, embers: 200 },
];
/** Width of the generated furnace art, and its tint from cold to roaring (one per heat stage). */
const FURNACE_ART_WIDTH = 360;
const FURNACE_TINTS = [0x9fb3c6, 0xc9d3dd, 0xe3e8ee, 0xf4f4f4, 0xffffff];
/** Where the chimney mouth is in the furnace art, as fractions of its cropped size (matches src/assets/art/furnace.png). */
const FURNACE_ART_CHIMNEY = { x: 0.855, y: 0.19 };
/** Jans sharing a job stand in a little group around its work spot. */
const CROWD = { perRow: 4, dx: 26, dy: 24 } as const;

/** Draw order: background < world (sorted by y) < snowfall < debug < edge arrows < HUD < menus. */
const DEPTH = { background: -10000, snowfall: 5000, debug: 9000, arrows: 9500, hud: 10000 } as const;

export class CityScene extends Phaser.Scene {
  heatBar!: HeatBar;
  private meagan!: MeaganSprite;
  private sites: SiteView[] = [];
  private picker!: BuildPicker;
  private debug!: Phaser.GameObjects.Graphics;
  private fireHolder!: Phaser.GameObjects.Container;
  private furnaceArt: Phaser.GameObjects.Image | null = null;
  private glow!: Phaser.GameObjects.Ellipse;
  private embers!: Phaser.GameObjects.Particles.ParticleEmitter;
  private heatStage = -1;
  private tierShown = 0;
  private decor: Phaser.GameObjects.GameObject[] = [];
  private nodes: NodeView[] = [];
  private arrows!: Phaser.GameObjects.Graphics;
  /** Camera drag: where the press started (screen px), whether it became a drag, and when to follow Meagan again. */
  private pressAt: Point | null = null;
  private dragging = false;
  private following = true;
  private followResumeAt = 0;
  private readonly frozen = new Map<number, JanSprite>();
  private readonly jans = new Map<number, JanSprite>();
  private readonly animals = new Map<number, AnimalSprite>();
  /** Where a just-thawed Jan starts walking from (map units), keyed by Jan id. */
  private readonly thawedAt = new Map<number, Point>();
  /** What a just-thawed Jan says once his sprite exists, keyed by Jan id. */
  private readonly thawLine = new Map<number, string>();
  private chatterIn = CHATTER_MIN_MS;
  private lastBag = 0;
  private bagFlow = 0;
  private bagSoundGap = 0;
  /** engine.loadCount when this scene was built; a different value means a save was loaded. */
  private builtFor = 0;

  constructor() {
    super('City');
  }

  preload(): void {
    preloadArt(this);
  }

  create(): void {
    trimArt(this);
    // create() runs again on restart, so start from empty sprite maps.
    this.frozen.clear();
    this.jans.clear();
    this.animals.clear();
    this.thawedAt.clear();
    this.thawLine.clear();
    this.lastBag = bagTotal(engine.state);
    this.bagFlow = 0;
    this.builtFor = engine.loadCount;
    this.furnaceArt = null;
    this.heatStage = -1;
    this.tierShown = 0;
    this.decor = [];
    this.makeTextures();
    this.drawBackground();
    this.nodes = RESOURCE_NODES.map((_, i) => new NodeView(this, i));
    this.drawFurnace();
    this.addSnowfall();

    this.sites = SITES.map((_, i) => new SiteView(this, i));
    this.meagan = new MeaganSprite(this, toScreen(engine.state.meagan));
    this.picker = new BuildPicker(this, engine);
    this.debug = this.add.graphics().setDepth(DEPTH.debug);
    this.arrows = this.add.graphics().setDepth(DEPTH.arrows).setScrollFactor(0);

    this.heatBar = new HeatBar(this, 48, 36, GAME_WIDTH - 96);
    this.heatBar.setDepth(DEPTH.hud).setScrollFactor(0, 0, true);
    this.syncHeat();

    // The camera roams the whole world and follows Meagan.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.centerOn(this.meagan.x, this.meagan.y - FOLLOW_OFFSET_Y);
    this.following = false;
    this.followMeagan();
    this.pressAt = null;
    this.dragging = false;

    // One finger: a short press is a tap (walk/act); moving further drags the view around.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      this.pressAt = over.length === 0 ? { x: p.x, y: p.y } : null;
      this.dragging = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.pressAt) return;
      if (!this.dragging && Phaser.Math.Distance.Between(p.x, p.y, this.pressAt.x, this.pressAt.y) < DRAG_THRESHOLD) return;
      if (!this.dragging) {
        this.dragging = true;
        this.following = false;
        cam.stopFollow();
      }
      cam.scrollX -= p.x - p.prevPosition.x;
      cam.scrollY -= p.y - p.prevPosition.y;
      this.followResumeAt = this.time.now + FOLLOW_RESUME_MS;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const tap = this.pressAt !== null && !this.dragging && over.length === 0;
      this.pressAt = null;
      this.dragging = false;
      if (tap) this.onTap(toWorld({ x: p.worldX, y: p.worldY }));
    });
  }

  /** Smoothly follow Meagan again (after a drag). */
  private followMeagan(): void {
    if (this.following) return;
    this.following = true;
    this.cameras.main.startFollow(this.meagan, false, FOLLOW_LERP, FOLLOW_LERP).setFollowOffset(0, FOLLOW_OFFSET_Y);
  }

  update(_time: number, delta: number): void {
    if (engine.loadCount !== this.builtFor) {
      this.scene.restart(); // a different city was loaded: rebuild every sprite from the new state
      return;
    }
    engine.advance(delta);
    for (const e of engine.drainEvents()) {
      this.onEvent(e);
      bus.emit(e);
    }

    const s = engine.state;
    this.syncHeat();
    for (const v of this.sites) v.sync(s);
    this.meagan.follow(toScreen(s.meagan), s.meagan.path.length > 0, delta);
    this.meagan.setBag(s.meagan.bag, carryLimit(s));
    this.meagan.setHealth(s.meagan.hp / MEAGAN.hp, s.meagan.injured);
    this.bagSounds(s, delta);
    this.syncJans(s, delta);
    this.syncAnimals(s, delta);
    this.chatter(s, delta);
    s.nodes.forEach((stock, i) => this.nodes[i].sync(stock));
    if (!this.following && !this.dragging && this.time.now >= this.followResumeAt) this.followMeagan();
    this.drawEdgeArrows(s);
    this.drawDebug();
  }

  /** A tap on open map: a site walks her there to act, the gathering spots walk her onto them, anywhere else just walks. */
  private onTap(p: Point): void {
    this.followMeagan();
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
    const spot = RESOURCE_NODES.map((n) => n.at).find((g) => distance(g, p) <= GATHER_TAP_RADIUS);
    if (engine.walkTo(spot ?? p)) this.tapMarker(engine.state.meagan.path.at(-1)!);
  }

  private onEvent(e: EngineEvent): void {
    if (e.type === 'plotReached') this.picker.open(e.site);
    else if (e.type === 'rescued') {
      this.thawedAt.set(e.jan.id, e.from);
      this.thawLine.set(e.jan.id, rescueLine(e.jan.variant));
      this.floater(above(e.from), `Jan thawed! → ${JOB_LABELS[e.jan.job]}`);
    } else if (e.type === 'rescueBlocked') {
      const w = engine.state.waiting.find((a) => a.id === e.id);
      if (w) this.floater(above(w), 'No room!\nUpgrade the Furnace or build a Bunkhouse');
    } else if (e.type === 'animalKilled') this.floater(above(e.at), `+${formatNumber(e.food)} Food · +${formatNumber(e.materials)} Mat`);
    else if (e.type === 'janScared') this.floater(above(e.at), 'A Jan ran off for good!');
    else if (e.type === 'meaganInjured') this.floater(above(engine.state.meagan), 'Ouch! Meagan needs a rest');
    else if (e.type === 'furnaceHit') {
      const lost = [`−${formatNumber(e.wood)} Wood`, `−${formatNumber(e.food)} Food`, e.jansLost > 0 ? `${e.jansLost} Jan${e.jansLost > 1 ? 's' : ''} fled` : ''];
      this.floater(this.sites[0].top, `Raided! ${lost.filter(Boolean).join(' · ')}`);
    }
    else if (e.type === 'upgradeStarted') {
      const cost = nextCost(engine.state, e.building);
      this.floater(this.sites[e.site].top, `Bring ${formatCost(cost)}`);
      saveNow();
    } else if (e.type === 'buildingUpgraded') {
      saveNow();
      const name = buildingName(e.building);
      this.tweens.add({ targets: this.sites[e.site], scaleY: 1.12, scaleX: 0.94, duration: 140, yoyo: true, ease: 'Quad.out' });
      this.floater(this.sites[e.site].top, e.level === 1 ? `${name} built!` : `${name} Lv ${e.level}!`);
    }
  }

  private syncHeat(): void {
    const s = engine.state;
    const f = s.heat / heatCap(s);
    this.heatBar.setValue(f);
    const stage = s.heat <= 0 ? 0 : Math.min(HEAT_STAGES.length - 1, 1 + Math.floor(f * (HEAT_STAGES.length - 1)));
    if (stage !== this.heatStage) {
      this.heatStage = stage;
      const look = HEAT_STAGES[stage];
      this.fireHolder.setScale(look.fire).setVisible(look.fire > 0 && !this.furnaceArt);
      this.furnaceArt?.setTint(FURNACE_TINTS[stage]);
      this.glow.setScale(look.glow).setVisible(look.glow > 0);
      if (look.embers > 0) {
        this.embers.frequency = look.embers;
        if (!this.embers.emitting) this.embers.start();
      } else this.embers.stop();
    }
    const tier = tierOf(s.buildings.furnace);
    if (tier !== this.tierShown) this.drawDecor(tier);
  }

  /** Each tier dresses the town up a little: Tier 2 string lights, Tier 3 flags, lanterns and deeper drifts. */
  private drawDecor(tier: number): void {
    this.tierShown = tier;
    for (const o of this.decor) o.destroy();
    this.decor = [];
    const bulbs = [COLOURS.emberGlow, COLOURS.frostSoft, COLOURS.ember];
    if (tier >= 2) {
      // String lights under the furnace's snow cap, left of the chimney.
      const lights = this.add.graphics().setDepth(FURNACE_Y + 1);
      const y0 = FURNACE_Y - 300 + 34;
      const points: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        points.push({ x: FURNACE_X - 150 + t * 190, y: y0 + Math.sin(t * Math.PI) * 26 });
      }
      lights.lineStyle(3, COLOURS.ink, 0.8).strokePoints(points);
      points.forEach((p, i) => lights.fillStyle(bulbs[i % bulbs.length], 1).fillCircle(p.x, p.y + 5, 6));
      this.decor.push(lights);
    }
    if (tier >= 3) {
      // Flags on the furnace's top corners and lanterns either side of its door.
      const capTop = FURNACE_Y - 300 - 22;
      const flags = this.add.graphics().setDepth(FURNACE_Y + 1);
      for (const fx of [FURNACE_X - 140, FURNACE_X + 140]) {
        flags.fillStyle(COLOURS.slate, 1).fillRect(fx - 3, capTop - 80, 6, 80);
        flags.fillStyle(COLOURS.ember, 1).fillTriangle(fx + 3, capTop - 80, fx + 46, capTop - 67, fx + 3, capTop - 54);
        flags.lineStyle(3, COLOURS.ink, 1).strokeTriangle(fx + 3, capTop - 80, fx + 46, capTop - 67, fx + 3, capTop - 54);
      }
      this.decor.push(flags);
      for (const dx of [-120, 120]) {
        const p = toScreen({ x: dx, y: 40 });
        const lantern = this.add.graphics().setDepth(p.y);
        lantern.fillStyle(COLOURS.ink, 1).fillRect(p.x - 3, p.y - 70, 6, 70);
        lantern.fillStyle(COLOURS.emberGlow, 1).fillRoundedRect(p.x - 12, p.y - 96, 24, 28, 6);
        lantern.lineStyle(3, COLOURS.ink, 1).strokeRoundedRect(p.x - 12, p.y - 96, 24, 28, 6);
        this.decor.push(lantern);
      }
      const drifts = this.add.graphics().setDepth(DEPTH.background + 2);
      for (const at of [toScreen({ x: -560, y: 960 }), toScreen({ x: 560, y: 940 }), toScreen({ x: 0, y: -860 })]) {
        drifts.fillStyle(COLOURS.ice, 1).fillEllipse(at.x, at.y, 280, 100);
      }
      this.decor.push(drifts);
    }
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
    // Keep it inside the camera's view near the edges.
    const view = this.cameras.main.worldView;
    t.x = Phaser.Math.Clamp(t.x, view.x + t.width / 2 + 8, view.right - t.width / 2 - 8);
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
      if (!sprite) this.frozen.set(w.id, (sprite = new JanSprite(this, toScreen(w), true, w.variant ? `jan-${w.variant}` : 'jan')));
      sprite.setTimer(w.leavesAt === null ? null : (w.leavesAt - s.t) / caravanWait(s));
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
        this.jans.set(jan.id, (sprite = new JanSprite(this, toScreen(from), false, `jan-${jan.variant}`)));
        const line = this.thawLine.get(jan.id);
        if (line) {
          sprite.say(line);
          sprite.bounce();
        }
        this.thawLine.delete(jan.id);
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

  /** Plinks as things go into her bag and out of it, like the ads. */
  private bagSounds(s: GameState, delta: number): void {
    const total = bagTotal(s);
    this.bagFlow += total - this.lastBag;
    this.lastBag = total;
    this.bagSoundGap -= delta;
    if (this.bagSoundGap > 0 || Math.abs(this.bagFlow) < BAG_SOUND_UNITS) return;
    (this.bagFlow > 0 ? sfx.pickup : sfx.deliver)();
    this.bagFlow = 0;
    this.bagSoundGap = BAG_SOUND_GAP_MS;
  }

  /** Now and then, a working Jan says something, but only while the city is calm. */
  private chatter(s: GameState, delta: number): void {
    this.chatterIn -= delta;
    if (this.chatterIn > 0) return;
    this.chatterIn = Phaser.Math.Between(CHATTER_MIN_MS, CHATTER_MAX_MS);
    if (s.blizzard.active || s.attack.active) return;
    const idleSprites = [...this.jans.values()].filter((j) => !j.walking && !j.speaking);
    if (idleSprites.length > 0) Phaser.Utils.Array.GetRandom(idleSprites).say(chatterLine());
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

  /** A frost-blue arrow at the screen edge for each frozen Jan out of view, pointing the way to him. */
  private drawEdgeArrows(s: GameState): void {
    const g = this.arrows;
    g.clear();
    const view = this.cameras.main.worldView;
    const cx = GAME_WIDTH / 2;
    const cy = (EDGE_ARROW_INSET.top + GAME_HEIGHT - EDGE_ARROW_INSET.bottom) / 2;
    for (const w of s.waiting) {
      const p = toScreen(w);
      if (view.contains(p.x, p.y - 50)) continue;
      // Direction from the middle of the visible area to the Jan, in screen space.
      const dx = p.x - view.x - cx;
      const dy = p.y - 50 - view.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const halfW = cx - EDGE_ARROW_INSET.side;
      const halfH = (GAME_HEIGHT - EDGE_ARROW_INSET.bottom - EDGE_ARROW_INSET.top) / 2;
      const t = Math.min(halfW / Math.max(Math.abs(ux), 1e-6), halfH / Math.max(Math.abs(uy), 1e-6));
      const ax = cx + ux * t;
      const ay = cy + uy * t;
      g.fillStyle(COLOURS.frost, 0.9).fillCircle(ax, ay, 24);
      g.lineStyle(4, COLOURS.ice, 1).strokeCircle(ax, ay, 24);
      // Arrowhead pointing outwards.
      const px = -uy;
      const py = ux;
      g.fillStyle(COLOURS.ice, 1).fillTriangle(ax + ux * 16, ay + uy * 16, ax - ux * 6 + px * 10, ay - uy * 6 + py * 10, ax - ux * 6 - px * 10, ay - uy * 6 - py * 10);
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
    // Sky fades into the snowfield, which covers the whole world.
    g.fillGradientStyle(COLOURS.sky, COLOURS.sky, COLOURS.snow, COLOURS.snow, 1);
    g.fillRect(0, 0, WORLD_W, HORIZON);
    g.fillStyle(COLOURS.snow, 1).fillRect(0, HORIZON, WORLD_W, WORLD_H - HORIZON);

    // Distant pines on the horizon.
    g.fillStyle(COLOURS.frostSoft, 0.55);
    for (let x = -20; x < WORLD_W + 40; x += 46) {
      const h = 70 + ((x * 37) % 50);
      g.fillTriangle(x, HORIZON + 10, x + 26, HORIZON - h, x + 52, HORIZON + 10);
    }

    // Soft drifts scattered over the snowfield in a fixed pattern.
    for (let i = 0; i < 26; i++) {
      const x = (i * 397) % WORLD_W;
      const y = HORIZON + 60 + ((i * 613) % (WORLD_H - HORIZON - 60));
      const w = 260 + ((i * 53) % 280);
      g.fillStyle(i % 3 === 0 ? COLOURS.ice : COLOURS.snowDeep, 1).fillEllipse(x, y, w, w * 0.28);
    }

    // Packed-snow clearing the furnace stands in.
    g.fillStyle(COLOURS.ice, 1).fillEllipse(FURNACE_X, FURNACE_Y, 560, 150);
    g.lineStyle(4, COLOURS.line, 1).strokeEllipse(FURNACE_X, FURNACE_Y, 560, 150);
  }

  private drawFurnace(): void {
    const x = FURNACE_X;
    const base = FURNACE_Y;

    // Warm glow pooled on the snow around the furnace.
    this.glow = this.add.ellipse(x, base, 520, 130, COLOURS.emberGlow, 0.25).setDepth(DEPTH.background + 1);
    this.tweens.add({ targets: this.glow, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Generated art replaces the drawn furnace; heat then shows as its tint (syncHeat) instead of a fire.
    let chimney: Point;
    if (hasArt(this, 'furnace')) {
      const art = artImage(this, 'furnace', x, base, { width: FURNACE_ART_WIDTH }).setDepth(base);
      this.furnaceArt = art;
      this.fireHolder = this.add.container(x, base - 80);
      chimney = {
        x: x + art.displayWidth * (FURNACE_ART_CHIMNEY.x - 0.5),
        y: base - art.displayHeight * (1 - FURNACE_ART_CHIMNEY.y),
      };
    } else chimney = this.drawFurnaceShape(x, base);

    // Embers drifting out of the chimney, faster the hotter the fire.
    this.embers = this.add
      .particles(chimney.x, chimney.y, 'ember', {
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

  /** The placeholder furnace: stone body, chimney, arched door and a flickering fire. Returns the chimney top. */
  private drawFurnaceShape(x: number, base: number): Point {
    const w = 300;
    const h = 300;
    const top = base - h;
    const outline = COLOURS.ink;

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
    // Its holder scales with heat (syncHeat); the fire itself flickers.
    const fire = this.add.graphics();
    fire.fillStyle(COLOURS.ember, 1).fillEllipse(0, 0, 120, 120);
    fire.fillStyle(COLOURS.emberGlow, 1).fillEllipse(0, 10, 70, 80);
    this.fireHolder = this.add.container(x, base - 80, [fire]).setDepth(base);
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

    return { x: x + 85, y: top - 170 };
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
      .setDepth(DEPTH.snowfall)
      .setScrollFactor(0);
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
