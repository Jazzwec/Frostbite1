// Timed pressure and arrivals: blizzards, Long Nights, Jan arrivals, caravans, scavenging, heat-zero departures.
import { ARRIVALS, BLIZZARD, BUILDINGS, CARAVAN, HEAT, KEYS_BONUS, SCAVENGE, VARIANTS } from './balance';
import { caps, caravanGap, grossRates, isUnlocked, janCap, janJobMult, neediestJob, scavengeBurst, scavengeInterval, tierOf } from './economy';
import { ARRIVAL_SPOTS, CARAVAN_SPOTS } from './map';
import { between, intBetween, pickWeighted, type Rng } from './rng';
import type { BuildingKey, EngineEvent, GameState, Jan, Point, ResourceKey, StoredResource, VariantKey } from './types';

export interface TickContext {
  rng: Rng;
  emit(e: EngineEvent): void;
}

// ---------- Blizzards ----------

export function blizzardWarning(s: GameState): number {
  const base = s.blizzard.long ? BLIZZARD.longNightWarning : BLIZZARD.warning;
  return base + BLIZZARD.watchtowerWarningPerLevel * s.buildings.watchtower;
}

export function scheduleBlizzard(s: GameState, rng: Rng): void {
  s.blizzard.next = s.t + between(rng, BLIZZARD.gapMin, BLIZZARD.gapMax);
  s.blizzard.warned = false;
  s.blizzard.long = false;
}

export function updateBlizzard(s: GameState, ctx: TickContext): void {
  const bz = s.blizzard;
  if (bz.active) {
    if (s.t >= bz.end) {
      bz.active = false;
      ctx.emit({ type: 'blizzardEnd', long: bz.long });
      scheduleBlizzard(s, ctx.rng);
    }
    return;
  }
  // Until it is announced, the next blizzard becomes a Long Night if the city has entered a new tier.
  if (!bz.warned) bz.long = tierOf(s.buildings.furnace) > s.longNightTier;
  if (s.t >= bz.next) {
    if (bz.long) s.longNightTier = tierOf(s.buildings.furnace);
    bz.active = true;
    bz.warned = true;
    bz.end = s.t + (bz.long ? BLIZZARD.longNightDuration : BLIZZARD.duration);
    ctx.emit({ type: 'blizzardStart', long: bz.long });
  } else if (!bz.warned && s.t >= bz.next - blizzardWarning(s)) {
    bz.warned = true;
    ctx.emit({ type: 'blizzardWarn', long: bz.long, startsIn: bz.next - s.t });
  }
}

// ---------- Jans ----------

export function variantUnlocked(s: GameState, v: VariantKey): boolean {
  const u = VARIANTS[v].unlock;
  return s.buildings[u.building] >= u.level;
}

export function pickVariant(s: GameState, rng: Rng, rareOnly = false): VariantKey {
  const weights: Partial<Record<VariantKey, number>> = {};
  for (const v of Object.keys(VARIANTS) as VariantKey[]) {
    if (rareOnly && v === 'plain') continue;
    if (variantUnlocked(s, v) && VARIANTS[v].weight > 0) weights[v] = VARIANTS[v].weight;
  }
  if (Object.keys(weights).length === 0) return 'plain';
  return pickWeighted(rng, weights);
}

/** First spot nobody is waiting on (spots are fixed, so exact matches are fine). */
function freeSpot(s: GameState, spots: Point[]): Point {
  return spots.find((p) => !s.waiting.some((w) => w.x === p.x && w.y === p.y)) ?? spots[0];
}

function addArrival(s: GameState, variant: VariantKey | null, fromCaravan: boolean, returning: boolean): number {
  const id = s.nextId++;
  const at = freeSpot(s, fromCaravan ? CARAVAN_SPOTS : ARRIVAL_SPOTS);
  s.waiting.push({
    id,
    x: at.x,
    y: at.y,
    variant,
    fromCaravan,
    returning,
    leavesAt: fromCaravan ? s.t + CARAVAN.waitSeconds : null,
  });
  return id;
}

export function updateArrivals(s: GameState, dt: number, ctx: TickContext, arrivalInterval: number): void {
  // Caravan Jans who waited too long move on.
  const before = s.waiting.length;
  s.waiting = s.waiting.filter((w) => w.leavesAt === null || w.leavesAt > s.t);
  if (s.waiting.length < before) ctx.emit({ type: 'caravanLeft', count: before - s.waiting.length });

  if (s.blizzard.active) return; // no arrivals in a blizzard

  s.arrivalTimer += dt;
  if (s.arrivalTimer >= arrivalInterval) {
    s.arrivalTimer = 0;
    if (s.waiting.length < ARRIVALS.maxWaiting) ctx.emit({ type: 'arrival', id: addArrival(s, null, false, false) });
  }

  if (s.t >= s.caravanNext) {
    s.caravanNext = s.t + caravanGap(s, between(ctx.rng, CARAVAN.gapMin, CARAVAN.gapMax));
    let count = 0;
    for (const v of s.wanderedOff.splice(0)) {
      if (s.waiting.length >= ARRIVALS.maxWaitingCaravan) break;
      addArrival(s, v, true, true);
      count++;
    }
    const n = intBetween(ctx.rng, CARAVAN.minJans, CARAVAN.maxJans);
    for (let i = 0; i < n && s.waiting.length < ARRIVALS.maxWaitingCaravan; i++) {
      addArrival(s, i === 0 ? pickVariant(s, ctx.rng, true) : null, true, false);
      count++;
    }
    ctx.emit({ type: 'caravan', count });
  }
}

/** Thaw a waiting Jan; he heads for the neediest job. When the city is full he stays frozen and rescueBlocked fires. */
export function rescueArrival(s: GameState, arrivalId: number, ctx: TickContext): Jan | null {
  const i = s.waiting.findIndex((w) => w.id === arrivalId);
  if (i < 0 || s.meagan.injured) return null;
  if (s.jans.length >= janCap(s)) {
    ctx.emit({ type: 'rescueBlocked', id: arrivalId });
    return null;
  }
  const [w] = s.waiting.splice(i, 1);
  const jan: Jan = { id: w.id, variant: w.variant ?? pickVariant(s, ctx.rng), job: neediestJob(s), hasKit: false };
  s.jans.push(jan);
  ctx.emit({ type: 'rescued', jan, returning: w.returning, from: { x: w.x, y: w.y } });
  if (jan.variant === 'keys' && !w.returning) {
    const bonus = keysBonus(s, ctx.rng);
    addCapped(s, bonus.resource, bonus.amount);
    ctx.emit({ type: 'keysBonus', ...bonus });
  }
  return jan;
}

/** Lost-His-Keys Jan finds some of a random resource on rescue. */
export function keysBonus(s: GameState, rng: Rng): { resource: StoredResource; amount: number } {
  const resource = pickWeighted<StoredResource>(rng, { wood: 1, food: 1, materials: 1 });
  const min = resource === 'materials' ? KEYS_BONUS.minimumMaterials : KEYS_BONUS.minimum;
  const amount = Math.max(min, grossRates(s)[resource] * KEYS_BONUS.seconds);
  return { resource, amount };
}

// ---------- Scavenging ----------

export function updateScavenging(s: GameState, dt: number, ctx: TickContext, outputMult: number): void {
  if (s.buildings.expeditionPost <= 0) return;
  let crew = 0;
  for (const j of s.jans) if (j.job === 'scavenge') crew += janJobMult(j, 'scavenge');
  if (crew <= 0) return;

  s.scavengeProgress += (dt * crew * outputMult) / scavengeInterval(s);
  while (s.scavengeProgress >= 1) {
    s.scavengeProgress -= 1;
    if (ctx.rng() < SCAVENGE.cacheChance) foundCache(s, ctx);
    else {
      const resource = pickWeighted<StoredResource>(ctx.rng, SCAVENGE.weights);
      const amount = scavengeBurst(s, resource);
      addCapped(s, resource, amount);
      ctx.emit({ type: 'burst', resource, amount });
    }
  }
}

function foundCache(s: GameState, ctx: TickContext): void {
  if (ctx.rng() < SCAVENGE.cacheFreeLevelChance) {
    const eligible = (Object.keys(BUILDINGS) as BuildingKey[]).filter(
      (k) => k !== 'furnace' && isUnlocked(s, k) && s.buildings[k] >= 1 && s.buildings[k] < BUILDINGS[k].max,
    );
    if (eligible.length > 0) {
      const building = eligible[Math.floor(ctx.rng() * eligible.length)];
      s.buildings[building]++;
      ctx.emit({ type: 'cacheLevel', building });
      return;
    }
  }
  const amount = scavengeBurst(s, 'materials') * SCAVENGE.cacheMaterialsMult;
  addCapped(s, 'materials', amount);
  ctx.emit({ type: 'cache', resource: 'materials', amount });
}

export function addCapped(s: GameState, resource: ResourceKey, amount: number): void {
  const cap = resource === 'knowledge' ? Infinity : caps(s)[resource];
  s.resources[resource] = Math.min(cap, s.resources[resource] + amount);
}

// ---------- Heat zero ----------

export function updateHeatZero(s: GameState, dt: number, ctx: TickContext): void {
  if (s.heat > 0 || s.jans.length === 0) {
    s.leaveTimer = 0;
    return;
  }
  s.leaveTimer += dt;
  if (s.leaveTimer < HEAT.leaveEverySeconds) return;
  s.leaveTimer = 0;
  const jan = s.jans.splice(Math.floor(ctx.rng() * s.jans.length), 1)[0];
  s.wanderedOff.push(jan.variant);
  ctx.emit({ type: 'janWanderedOff', jan });
}
