// The game's rules engine: owns state, runs the fixed tick, exposes player actions. No Phaser or DOM in here.
import { BLIZZARD, BUILDINGS, CARAVAN, GEAR, MAX_ADVANCE_SECONDS, MEAGAN, START, TICK_SECONDS } from './balance';
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
  janCap,
  jobRate,
  jobUnlocked,
  kitCost,
  type Cost,
} from './economy';
import { addCapped, keysBonus, pickVariant, updateArrivals, updateBlizzard, updateHeatZero, updateScavenging, type TickContext } from './events';
import { FOREST, FURNACE, HUNTING_GROUNDS, distance } from './map';
import { seededRng, type Rng } from './rng';
import type { Assignment, BuildingKey, EngineEvent, GameState, GearKey, Jan, Point, ResourceKey } from './types';

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
    meagan: { x: FURNACE.x, y: FURNACE.y, hp: MEAGAN.hp, injured: false },
    nextId: 1,
    arrivalTimer: 0,
    caravanNext: CARAVAN.firstAt,
    leaveTimer: 0,
    scavengeProgress: 0,
    blizzard: { next: BLIZZARD.firstAt, active: false, end: 0, long: false, warned: false },
    longNightTier: 1,
    attack: { next: Infinity, warned: false, active: false, animals: [], guards: [], breached: false },
    burnRate: 0,
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

  constructor(opts: EngineOptions = {}) {
    this.state = opts.state ?? newWinterState();
    this.rng = opts.rng ?? seededRng(opts.seed ?? Date.now());
    this.ctx = { rng: this.rng, emit: (e) => this.events.push(e) };
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

    // Meagan gathers by hand when she's at the forest or the hunting grounds.
    const m = s.meagan;
    const fighting = s.attack.active && s.attack.animals.some((a) => distance(a, m) <= MEAGAN.range);
    if (!m.injured && !fighting) {
      if (distance(m, FOREST) <= MEAGAN.gatherRange) s.resources.wood += MEAGAN.woodPerSecond * dt;
      if (distance(m, HUNTING_GROUNDS) <= MEAGAN.gatherRange) s.resources.food += MEAGAN.foodPerSecond * dt;
    }

    // Jan output, then eating.
    s.resources.wood += jobRate(s, 'chop') * dt;
    s.resources.food += (jobRate(s, 'hunt') - foodEaten(s)) * dt;
    s.resources.materials += jobRate(s, 'build') * dt;
    s.resources.knowledge += jobRate(s, 'research') * dt;
    updateScavenging(s, dt, this.ctx, conditionMult(s));

    // The furnace burns whatever Wood it needs to stay full, then drains.
    const drain = heatDrain(s) * dt;
    const hpw = heatPerWood(s);
    const cap = heatCap(s);
    const burn = Math.min(Math.max(0, s.resources.wood), Math.max(0, cap - s.heat + drain) / hpw);
    s.resources.wood -= burn;
    s.burnRate = burn / dt;
    s.heat = Math.min(cap, Math.max(0, s.heat + burn * hpw - drain));

    const c = caps(s);
    for (const k of ['wood', 'food', 'materials'] as const) s.resources[k] = Math.min(c[k], Math.max(0, s.resources[k]));

    updateArrivals(s, dt, this.ctx, arrivalInterval(s));
    updateHeatZero(s, dt, this.ctx);
  }

  /** Events since the last call, oldest first. */
  drainEvents(): EngineEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------- Actions ----------

  /** The City scene reports where Meagan is. Ignored while she's injured. */
  setMeaganPosition(p: Point): void {
    if (this.state.meagan.injured) return;
    this.state.meagan.x = p.x;
    this.state.meagan.y = p.y;
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

  /** Thaw a waiting Jan into the idle pool. */
  rescue(arrivalId: number): Jan | null {
    const s = this.state;
    const i = s.waiting.findIndex((w) => w.id === arrivalId);
    if (i < 0 || s.jans.length >= janCap(s) || s.meagan.injured) return null;
    const [w] = s.waiting.splice(i, 1);
    const jan: Jan = { id: w.id, variant: w.variant ?? pickVariant(s, this.rng), job: 'idle', hasKit: false };
    s.jans.push(jan);
    this.ctx.emit({ type: 'rescued', jan, returning: w.returning });
    if (jan.variant === 'keys' && !w.returning) {
      const bonus = keysBonus(s, this.rng);
      addCapped(s, bonus.resource, bonus.amount);
      this.ctx.emit({ type: 'keysBonus', ...bonus });
    }
    return jan;
  }

  private pay(cost: Cost): void {
    for (const [k, v] of Object.entries(cost) as Array<[ResourceKey, number]>) this.state.resources[k] -= v;
  }
}
