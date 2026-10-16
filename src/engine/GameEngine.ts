// The game's rules engine: owns state, runs the fixed tick, exposes player actions. No Phaser or DOM in here.
import { AUTO_JOB, BLIZZARD, BUILDINGS, CARAVAN, GEAR, MAX_ADVANCE_SECONDS, MEAGAN, PATH, START, TICK_SECONDS, VARIANTS } from './balance';
import { updateAttacks } from './combat';
import {
  arrivalInterval,
  buildingCost,
  canAfford,
  caps,
  conditionMult,
  foodEaten,
  gearCost,
  heatCap,
  heatDrain,
  heatPerWood,
  isUnlocked,
  janToRelease,
  jobRate,
  jobUnlocked,
  kitCost,
  pickJanFor,
  type Cost,
} from './economy';
import { rescueArrival, updateArrivals, updateBlizzard, updateHeatZero, updateScavenging, type TickContext } from './events';
import { MAP_BOUNDS, MEAGAN_START, SITES, siteIndexOf } from './map';
import { rebalanceJobs, updateAutoAssign } from './jobs';
import { updateMeagan } from './meagan';
import { buildGrid, findPath, type NavGrid } from './pathfinding';
import { seededRng, type Rng } from './rng';
import type { Assignment, BuildingKey, EngineEvent, GameState, GearKey, Jan, JobKey, Point, ResourceKey, VariantKey } from './types';

export function newWinterState(): GameState {
  const buildings = Object.fromEntries(
    (Object.keys(BUILDINGS) as BuildingKey[]).map((k) => [k, BUILDINGS[k].start]),
  ) as Record<BuildingKey, number>;
  return {
    t: 0,
    heat: START.heat,
    resources: { ...START.resources },
    buildings,
    gear: { weapons: 0, armour: 0 },
    jans: [],
    waiting: [],
    wanderedOff: [],
    meagan: {
      x: MEAGAN_START.x,
      y: MEAGAN_START.y,
      hp: MEAGAN.hp,
      injured: false,
      path: [],
      bag: { wood: 0, food: 0, materials: 0 },
      goal: null,
    },
    fuel: 0,
    sites: SITES.map((d) => ({ building: d.fixed ?? null, upgrading: false, progress: {} })),
    nextId: 1,
    arrivalTimer: 0,
    caravanNext: CARAVAN.firstAt,
    leaveTimer: 0,
    scavengeProgress: 0,
    blizzard: { next: BLIZZARD.firstAt, active: false, end: 0, long: false, warned: false },
    longNightTier: 1,
    attack: { next: Infinity, warned: false, active: false, animals: [], guards: [], breached: false },
    burnRate: 0,
    found: Object.fromEntries((Object.keys(VARIANTS) as VariantKey[]).map((v) => [v, 0])) as Record<VariantKey, number>,
    stats: { rescued: 0 },
    autoAssign: false,
    autoAssignTimer: 0,
  };
}

export interface EngineOptions {
  seed?: number;
  rng?: Rng;
  state?: GameState;
}

export class GameEngine {
  state: GameState;
  private readonly rng: Rng;
  private readonly ctx: TickContext;
  private events: EngineEvent[] = [];
  private accumulator = 0;
  private paused = false;
  private navGrid!: NavGrid;
  private loads = 0;

  constructor(opts: EngineOptions = {}) {
    this.state = opts.state ?? newWinterState();
    this.rng = opts.rng ?? seededRng(opts.seed ?? Date.now());
    this.ctx = { rng: this.rng, emit: (e) => this.events.push(e) };
    this.rebuildNav();
  }

  /** Replace the whole state (import, new winter). The renderer watches loadCount to rebuild its sprites. */
  load(state: GameState): void {
    this.state = state;
    this.events = [];
    this.accumulator = 0;
    this.loads++;
    this.rebuildNav();
  }

  /** Bumped on every load(). */
  get loadCount(): number {
    return this.loads;
  }

  /** Walkability grid for the current buildings (read-only; the renderer draws it in debug mode). */
  get nav(): NavGrid {
    return this.navGrid;
  }

  /** Every site with a building (or a construction site) blocks walking. */
  private rebuildNav(): void {
    const obstacles = SITES.filter((_, i) => this.state.sites[i].building !== null).map((d) => d.footprint);
    this.navGrid = buildGrid(MAP_BOUNDS, obstacles, PATH.cellSize, PATH.clearance);
  }

  // ---------- Time ----------

  get isPaused(): boolean {
    return this.paused;
  }

  /** Stop the clock (tab hidden). Nothing happens until resume(). */
  pause(): void {
    this.paused = true;
  }

  /** Restart the clock with no catch-up for the time spent paused. */
  resume(): void {
    this.paused = false;
    this.accumulator = 0;
  }

  /** Feed real elapsed milliseconds; runs whole fixed ticks. Returns the number of ticks run. */
  advance(ms: number): number {
    if (this.paused || ms <= 0) return 0;
    this.accumulator += Math.min(ms / 1000, MAX_ADVANCE_SECONDS);
    let ticks = 0;
    while (this.accumulator >= TICK_SECONDS - 1e-9) {
      this.accumulator -= TICK_SECONDS;
      this.tick();
      ticks++;
    }
    return ticks;
  }

  /** Run exactly one fixed step. */
  tick(dt = TICK_SECONDS): void {
    const s = this.state;
    s.t += dt;

    updateBlizzard(s, this.ctx);
    updateAttacks(s, dt, this.ctx);
    updateMeagan(s, dt, this.ctx);

    // Jan output piles up at the producers; Jans eat from the food storage.
    s.resources.wood += jobRate(s, 'chop') * dt;
    s.resources.food += (jobRate(s, 'hunt') - foodEaten(s)) * dt;
    s.resources.materials += jobRate(s, 'build') * dt;
    s.resources.knowledge += jobRate(s, 'research') * dt;
    updateScavenging(s, dt, this.ctx, conditionMult(s));

    // The furnace burns whatever delivered fuel it needs to stay full, then drains.
    const drain = heatDrain(s) * dt;
    const hpw = heatPerWood(s);
    const cap = heatCap(s);
    const burn = Math.min(Math.max(0, s.fuel), Math.max(0, cap - s.heat + drain) / hpw);
    s.fuel -= burn;
    s.burnRate = burn / dt;
    s.heat = Math.min(cap, Math.max(0, s.heat + burn * hpw - drain));

    const c = caps(s);
    for (const k of ['wood', 'food', 'materials'] as const) s.resources[k] = Math.min(c[k], Math.max(0, s.resources[k]));

    updateArrivals(s, dt, this.ctx, arrivalInterval(s));
    updateHeatZero(s, dt, this.ctx);
    updateAutoAssign(s, dt);
  }

  /** Events since the last call, oldest first. */
  drainEvents(): EngineEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------- Actions ----------

  /** Dev teleport: put Meagan somewhere and stop her walking. Ignored while she's injured. */
  setMeaganPosition(p: Point): void {
    const m = this.state.meagan;
    if (m.injured) return;
    m.x = p.x;
    m.y = p.y;
    m.path = [];
    m.goal = null;
  }

  /** Walk Meagan to a map point, around buildings. False if she's injured or there's no way there. */
  walkTo(p: Point): boolean {
    const m = this.state.meagan;
    if (m.injured) return false;
    const path = findPath(this.navGrid, m, p);
    if (path.length === 0) return false;
    m.path = path;
    m.goal = null;
    return true;
  }

  /** Walk to a site; on arrival she asks what to build on a plot, or starts upgrading a building. */
  tapSite(site: number): boolean {
    if (!SITES[site] || !this.walkTo(SITES[site].drop)) return false;
    this.state.meagan.goal = { kind: 'site', site };
    return true;
  }

  /** Can this building go on an empty plot? Unlocked, not yet placed and not maxed. */
  canPlace(key: BuildingKey): boolean {
    const s = this.state;
    return isUnlocked(s, key) && siteIndexOf(s, key) < 0 && s.buildings[key] < BUILDINGS[key].max;
  }

  /** Turn an empty plot into a construction site for a building; Meagan then delivers its cost. */
  chooseBuilding(site: number, key: BuildingKey): boolean {
    const st = this.state.sites[site];
    if (!st || st.building !== null || !this.canPlace(key)) return false;
    st.building = key;
    st.upgrading = true;
    st.progress = {};
    this.rebuildNav();
    this.ctx.emit({ type: 'upgradeStarted', site, building: key });
    return true;
  }

  canBuy(key: BuildingKey): boolean {
    const s = this.state;
    return isUnlocked(s, key) && s.buildings[key] < BUILDINGS[key].max && canAfford(s, this.costOf(key));
  }

  costOf(key: BuildingKey): Cost {
    return buildingCost(key, this.state.buildings[key]);
  }

  buy(key: BuildingKey): boolean {
    if (!this.canBuy(key)) return false;
    this.pay(this.costOf(key));
    this.state.buildings[key]++;
    return true;
  }

  buyGear(key: GearKey): boolean {
    const s = this.state;
    if (s.buildings.barracks < 1 || s.gear[key] >= GEAR.max) return false;
    const cost = gearCost(s.gear[key]);
    if (!canAfford(s, cost)) return false;
    this.pay(cost);
    s.gear[key]++;
    return true;
  }

  /** Equip one guard without a kit. */
  buyKit(): boolean {
    const s = this.state;
    const guard = s.jans.find((j) => j.job === 'guard' && !j.hasKit);
    const cost = kitCost(s.gear);
    if (!guard || !canAfford(s, cost)) return false;
    this.pay(cost);
    guard.hasKit = true;
    return true;
  }

  assign(janId: number, job: Assignment): boolean {
    const jan = this.state.jans.find((j) => j.id === janId);
    if (!jan || (job !== 'idle' && !jobUnlocked(this.state, job))) return false;
    jan.job = job;
    return true;
  }

  /** Jans screen +: move a Jan onto this job (an idle one first). Choosing by hand turns Auto-assign off. */
  addToJob(job: JobKey): boolean {
    const id = pickJanFor(this.state, job);
    if (id === null || !this.assign(id, job)) return false;
    this.state.autoAssign = false;
    return true;
  }

  /** Jans screen −: send this job's newest Jan to idle. Turns Auto-assign off. */
  removeFromJob(job: JobKey): boolean {
    const id = janToRelease(this.state, job);
    if (id === null || !this.assign(id, 'idle')) return false;
    this.state.autoAssign = false;
    return true;
  }

  canAutoAssign(): boolean {
    return this.state.buildings.furnace >= AUTO_JOB.unlockFurnace;
  }

  /** Switch Auto-assign; turning it on rebalances straight away. Refused before it unlocks. */
  setAutoAssign(on: boolean): boolean {
    if (on && !this.canAutoAssign()) return false;
    this.state.autoAssign = on;
    this.state.autoAssignTimer = 0;
    if (on) rebalanceJobs(this.state);
    return true;
  }

  /** Thaw a waiting Jan on the spot (dev/tests; in play Meagan walks out via tapArrival). He heads for the neediest job. */
  rescue(arrivalId: number): Jan | null {
    return rescueArrival(this.state, arrivalId, this.ctx);
  }

  /** Walk Meagan out to a frozen Jan; she thaws him when she gets there. */
  tapArrival(id: number): boolean {
    const w = this.state.waiting.find((a) => a.id === id);
    if (!w || !this.walkTo(w)) return false;
    this.state.meagan.goal = { kind: 'arrival', id };
    return true;
  }

  private pay(cost: Cost): void {
    for (const [k, v] of Object.entries(cost) as Array<[ResourceKey, number]>) this.state.resources[k] -= v;
  }
}
