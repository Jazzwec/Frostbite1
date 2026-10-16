// Meagan's rules: walking her path, acting on arrival, gathering by hand, and the magnet between her bag, piles and sites.
import { BUILDINGS, MAGNET, MEAGAN } from './balance';
import { bagTotal, bonusMult, caps, carryLimit, fuelCap, remainingCost } from './economy';
import { rescueArrival, type TickContext } from './events';
import { FOREST, HUNTING_GROUNDS, SCRAP_HEAP, SITES, distance, moveTowards, pileSiteIndex } from './map';
import type { GameState, Meagan, StoredResource } from './types';

/** Resources she can pick up from a pile to deliver elsewhere. Food only ever goes into the food storage. */
const PICKED_UP: StoredResource[] = ['wood', 'materials'];
const DELIVERED: StoredResource[] = ['wood', 'materials', 'food'];

export function updateMeagan(s: GameState, dt: number, ctx: TickContext): void {
  const m = s.meagan;
  if (m.injured) return;
  walk(m, MEAGAN.walkSpeed * bonusMult(s, 'walk') * dt);
  if (m.path.length === 0 && m.goal) arrive(s, ctx);

  const fighting = s.attack.active && s.attack.animals.some((a) => distance(a, m) <= MEAGAN.range);
  if (!fighting) gather(s, dt);
  magnet(s, dt, ctx);
}

/** Follow the waypoints, carrying leftover step past each corner. */
function walk(m: Meagan, step: number): void {
  while (step > 0 && m.path.length > 0) {
    const d = distance(m, m.path[0]);
    if (!moveTowards(m, m.path[0], step)) return;
    step -= d;
    m.path.shift();
  }
}

/** Frozen Jan → thaw him. Empty plot → ask what to build. Built building → start its next upgrade. */
function arrive(s: GameState, ctx: TickContext): void {
  const goal = s.meagan.goal!;
  s.meagan.goal = null;
  if (goal.kind === 'arrival') {
    rescueArrival(s, goal.id, ctx);
    return;
  }
  const i = goal.site;
  const site = s.sites[i];
  const key = site.building;
  if (!key) {
    ctx.emit({ type: 'plotReached', site: i });
    return;
  }
  if (site.upgrading || s.buildings[key] >= BUILDINGS[key].max) return;
  site.upgrading = true;
  ctx.emit({ type: 'upgradeStarted', site: i, building: key });
}

/** She gathers into her bag near the forest, the hunting grounds or the scrap heap. Cold and hunger don't slow her. */
function gather(s: GameState, dt: number): void {
  const m = s.meagan;
  if (distance(m, FOREST) <= MEAGAN.gatherRange) m.bag.wood += Math.min(MEAGAN.woodPerSecond * dt, room(s));
  if (distance(m, HUNTING_GROUNDS) <= MEAGAN.gatherRange) m.bag.food += Math.min(MEAGAN.foodPerSecond * dt, room(s));
  if (distance(m, SCRAP_HEAP) <= MEAGAN.gatherRange) m.bag.materials += Math.min(MEAGAN.materialsPerSecond * dt, room(s));
}

function room(s: GameState): number {
  return Math.max(0, carryLimit(s) - bagTotal(s));
}

/** Take up to `limit` of a resource out of her bag; returns how much came out. */
function unload(m: Meagan, res: StoredResource, limit: number): number {
  const n = Math.max(0, Math.min(m.bag[res], limit));
  m.bag[res] -= n;
  return n;
}

/** Near a site: deposit first (furnace fuel, food storage, construction/upgrade), then pick up from its pile. */
function magnet(s: GameState, dt: number, ctx: TickContext): void {
  const m = s.meagan;
  let budget = MAGNET.perSecond * dt;

  SITES.forEach((def, i) => {
    if (budget <= 0 || distance(m, def.drop) > MAGNET.radius) return;
    const site = s.sites[i];
    const key = site.building;
    if (!key) return;

    if (key === 'furnace') {
      const n = unload(m, 'wood', Math.min(budget, fuelCap(s) - s.fuel));
      s.fuel += n;
      budget -= n;
    }
    if (key === 'huntingLodge') {
      const n = unload(m, 'food', Math.min(budget, caps(s).food - s.resources.food));
      s.resources.food += n;
      budget -= n;
    }

    if (site.upgrading && s.buildings[key] >= BUILDINGS[key].max) site.upgrading = false;
    if (site.upgrading) {
      const need = remainingCost(s, site);
      for (const res of DELIVERED) {
        const n = unload(m, res, Math.min(budget, need[res] ?? 0));
        if (n <= 0) continue;
        site.progress[res] = (site.progress[res] ?? 0) + n;
        budget -= n;
      }
      if (Object.keys(remainingCost(s, site)).length === 0) {
        s.buildings[key]++;
        site.progress = {};
        site.upgrading = false;
        ctx.emit({ type: 'buildingUpgraded', site: i, building: key, level: s.buildings[key] });
      }
    }

    for (const res of PICKED_UP) {
      if (pileSiteIndex(s, res) !== i) continue;
      const n = Math.max(0, Math.min(s.resources[res], room(s), budget));
      s.resources[res] -= n;
      m.bag[res] += n;
      budget -= n;
    }
  });
}
