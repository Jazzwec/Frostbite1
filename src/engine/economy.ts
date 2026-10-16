// Pure rules derived from state: costs, caps, heat, rates. No mutation here.
import {
  ARRIVALS,
  AUTO_JOB,
  BLIZZARD,
  BUILDINGS,
  CAPS,
  CARAVAN,
  FOOD,
  FUEL,
  GEAR,
  GUARDS,
  HEAT,
  JAN_CAP,
  JOBS,
  MEAGAN,
  SCAVENGE,
  TIER_STARTS,
  VARIANTS,
} from './balance';
import type { Assignment, BuildingKey, GameState, GearKey, Jan, JobKey, ResourceKey, SiteState, StoredResource } from './types';

export type Cost = Partial<Record<ResourceKey, number>>;

/** The brief's one cost formula: base × growth^n. */
export function curve(base: number, growth: number, n: number): number {
  return base * growth ** n;
}

function roundCost(raw: Cost): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(raw) as Array<[ResourceKey, number]>) if (v > 0) out[k] = Math.ceil(v);
  return out;
}

/** Cost of the next level of a building; n = upgrades bought so far (level − starting level). */
export function buildingCost(key: BuildingKey, level: number): Cost {
  const def = BUILDINGS[key];
  const n = level - def.start;
  const woodOnly = def.firstUpgradeWoodOnly && n === 0;
  return roundCost({
    wood: curve(def.cost.wood, def.growth, n),
    materials: woodOnly ? 0 : curve(def.cost.materials, def.growth, n),
  });
}

export function gearCost(level: number): Cost {
  return roundCost({
    wood: curve(GEAR.cost.wood, GEAR.growth, level),
    materials: curve(GEAR.cost.materials, GEAR.growth, level),
  });
}

/** A guard's kit gets dearer as Weapons and Armour improve. */
export function kitCost(gear: Record<GearKey, number>): Cost {
  const n = gear.weapons + gear.armour;
  return roundCost({
    wood: curve(GEAR.kitCost.wood, GEAR.growth, n),
    materials: curve(GEAR.kitCost.materials, GEAR.growth, n),
  });
}

export function canAfford(s: GameState, cost: Cost): boolean {
  return (Object.entries(cost) as Array<[ResourceKey, number]>).every(([k, v]) => s.resources[k] >= v);
}

export function tierOf(furnaceLevel: number): number {
  let tier = 0;
  for (const start of TIER_STARTS) if (furnaceLevel >= start) tier++;
  return tier;
}

export function isUnlocked(s: GameState, key: BuildingKey): boolean {
  return s.buildings.furnace >= BUILDINGS[key].unlockFurnace;
}

/** What a site still needs delivered for its next level; empty when it has everything (or is an empty plot). */
export function remainingCost(s: GameState, site: SiteState): Cost {
  if (!site.building) return {};
  const out: Cost = {};
  const cost = buildingCost(site.building, s.buildings[site.building]);
  for (const [k, v] of Object.entries(cost) as Array<[StoredResource, number]>) {
    const left = v - (site.progress[k] ?? 0);
    if (left > 1e-6) out[k] = left; // tolerance for fractional deliveries
  }
  return out;
}

/** Most Meagan can carry: the base bag plus the Sled Shed. */
export function carryLimit(s: GameState): number {
  return MEAGAN.carryLimit + MEAGAN.carryPerSledLevel * s.buildings.sledShed;
}

export function bagTotal(s: GameState): number {
  const b = s.meagan.bag;
  return b.wood + b.food + b.materials;
}

// ---------- Heat ----------

/** Most Wood the furnace holds. */
export function fuelCap(s: GameState): number {
  return FUEL.capPerFurnaceLevel * s.buildings.furnace;
}

export function heatCap(s: GameState): number {
  return HEAT.capPerFurnaceLevel * s.buildings.furnace;
}

export function heatPerWood(s: GameState): number {
  return HEAT.perWood * (1 + HEAT.burnEfficiencyPerLevel * (s.buildings.furnace - 1));
}

export function buildingLevelsForDrain(s: GameState): number {
  let n = 0;
  for (const [k, lvl] of Object.entries(s.buildings) as Array<[BuildingKey, number]>) if (k !== 'furnace') n += lvl;
  return n;
}

/** Heat lost per second. */
export function heatDrain(s: GameState, blizzard = s.blizzard.active): number {
  const raw = HEAT.drainBase + HEAT.drainPerJan * s.jans.length + HEAT.drainPerBuildingLevel * buildingLevelsForDrain(s);
  const springs = Math.max(0, 1 - HEAT.hotSpringsReductionPerLevel * s.buildings.hotSprings);
  return raw * springs * (blizzard ? BLIZZARD.drainMult : 1);
}

// ---------- Storage and population ----------

export function caps(s: GameState): Record<StoredResource, number> {
  const store = CAPS.storehouseGrowth ** s.buildings.storehouse;
  return {
    wood: (CAPS.wood + CAPS.woodPerLumberLevel * s.buildings.lumberYard) * store,
    food: CAPS.food * store,
    materials: CAPS.materials * store,
  };
}

export function janCap(s: GameState): number {
  return JAN_CAP.perFurnaceLevel * s.buildings.furnace + JAN_CAP.perBunkhouseLevel * s.buildings.bunkhouse;
}

export function arrivalInterval(s: GameState): number {
  const fill = Math.min(1, s.jans.length / janCap(s));
  return ARRIVALS.baseInterval * (1 + ARRIVALS.fillSlowdown * fill * fill);
}

export function caravanGap(s: GameState, base: number): number {
  return base * (1 - CARAVAN.beaconSoonerPerLevel) ** s.buildings.signalBeacon;
}

// ---------- Output ----------

export function jobUnlocked(s: GameState, job: JobKey): boolean {
  return s.buildings[JOBS[job].building] > 0;
}

/** Cold and hunger slow every Jan. */
export function conditionMult(s: GameState): number {
  let m = 1;
  if (s.heat < HEAT.coldLine * heatCap(s)) m *= HEAT.coldOutputMult;
  if (s.resources.food <= 0) m *= FOOD.hungryOutputMult;
  return m;
}

export function janJobMult(jan: Jan, job: JobKey): number {
  const v = VARIANTS[jan.variant];
  return (v.jobMult?.[job] ?? 1) * (v.workMult ?? 1);
}

/** Per-Jan rate from the job's building level (compounding per level). */
export function perJanRate(s: GameState, job: JobKey): number {
  const def = JOBS[job];
  const level = s.buildings[def.building];
  if (level <= 0) return 0;
  return def.baseRate * def.growthPerLevel ** (level - 1);
}

/** Effective number of Jans on a job after variant bonuses. */
export function workforce(s: GameState, job: JobKey): number {
  let sum = 0;
  for (const j of s.jans) if (j.job === job) sum += janJobMult(j, job);
  return sum;
}

/** Gross production per second of the resource a job makes. */
export function jobRate(s: GameState, job: JobKey): number {
  return perJanRate(s, job) * workforce(s, job) * conditionMult(s);
}

export function grossRates(s: GameState): Record<ResourceKey, number> {
  return {
    wood: jobRate(s, 'chop'),
    food: jobRate(s, 'hunt'),
    materials: jobRate(s, 'build'),
    knowledge: jobRate(s, 'research'),
  };
}

export function foodEaten(s: GameState): number {
  let n = 0;
  for (const j of s.jans) n += VARIANTS[j.variant].foodMult ?? 1;
  const kitchen = Math.max(0, 1 - FOOD.kitchenReductionPerLevel * s.buildings.kitchen);
  return n * FOOD.perJanPerSecond * kitchen;
}

// ---------- Job choice (thawing, the Jans screen, Auto-assign) ----------

/** Jobs that thawing and Auto-assign hand out. Guarding and scavenging stay manual. */
export type AutoJob = keyof typeof AUTO_JOB.weights;
export const AUTO_JOBS = Object.keys(AUTO_JOB.weights) as AutoJob[];

export function isAutoJob(job: Assignment): job is AutoJob {
  return job in AUTO_JOB.weights;
}

/** Unlocked auto jobs, in priority order. */
export function openAutoJobs(s: GameState): AutoJob[] {
  return AUTO_JOBS.filter((j) => jobUnlocked(s, j));
}

function countJobs(s: GameState): Record<Assignment, number> {
  const counts = { chop: 0, hunt: 0, build: 0, research: 0, scavenge: 0, guard: 0, idle: 0 };
  for (const j of s.jans) counts[j.job]++;
  return counts;
}

/** The rule: the Lumber Yard first, then Hunting while eating outruns hunting, then the job furthest below its share. */
function nextAutoJob(open: AutoJob[], counts: Record<AutoJob, number>, hunted: number, eaten: number): AutoJob {
  const w = AUTO_JOB.weights;
  if (open.includes('chop') && counts.chop === 0) return 'chop';
  if (open.includes('hunt') && hunted < eaten) return 'hunt';
  return open.reduce((best, j) => (counts[j] / w[j] < counts[best] / w[best] ? j : best));
}

/** The job a newly thawed Jan walks to (his own eating included). */
export function neediestJob(s: GameState): Assignment {
  const open = openAutoJobs(s);
  if (open.length === 0) return 'idle';
  return nextAutoJob(open, countJobs(s), jobRate(s, 'hunt'), foodEaten(s) + FOOD.perJanPerSecond);
}

/** Auto-assign's target: the idle and auto-job Jans handed out one by one with the same rule. */
export function jobTargets(s: GameState): Record<AutoJob, number> {
  const targets: Record<AutoJob, number> = { chop: 0, hunt: 0, build: 0, research: 0 };
  const open = openAutoJobs(s);
  if (open.length === 0) return targets;
  const pool = s.jans.filter((j) => j.job === 'idle' || isAutoJob(j.job)).length;
  const perHunter = perJanRate(s, 'hunt') * conditionMult(s);
  const eaten = foodEaten(s);
  let hunted = 0;
  for (let i = 0; i < pool; i++) {
    const job = nextAutoJob(open, targets, hunted, eaten);
    targets[job]++;
    if (job === 'hunt') hunted += perHunter;
  }
  return targets;
}

function newestOn(s: GameState, job: Assignment): number | null {
  let id: number | null = null;
  for (const j of s.jans) if (j.job === job && (id === null || j.id > id)) id = j.id;
  return id;
}

/**
 * The Jan the Jans screen's + moves onto `job`: the newest idle Jan, else the newest from the auto job furthest
 * over its share, else from guarding or scavenging. Null if nobody can move.
 */
export function pickJanFor(s: GameState, job: Assignment): number | null {
  const idle = newestOn(s, 'idle');
  if (idle !== null || job === 'idle') return idle;
  const counts = countJobs(s);
  const w = AUTO_JOB.weights;
  const donors = AUTO_JOBS.filter((j) => j !== job && counts[j] > 0);
  if (donors.length > 0) return newestOn(s, donors.reduce((a, b) => (counts[b] / w[b] > counts[a] / w[a] ? b : a)));
  const manual = (['scavenge', 'guard'] as const).filter((j) => j !== job && counts[j] > 0);
  return manual.length > 0 ? newestOn(s, manual[0]) : null;
}

/** The Jan the Jans screen's − sends to idle: the newest on that job. */
export function janToRelease(s: GameState, job: JobKey): number | null {
  return newestOn(s, job);
}

export function scavengeInterval(s: GameState): number {
  return SCAVENGE.interval * SCAVENGE.intervalGrowth ** Math.max(0, s.buildings.expeditionPost - 1);
}

export function scavengeBurst(s: GameState, res: StoredResource): number {
  return SCAVENGE.bursts[res] * SCAVENGE.sizeGrowth ** Math.max(0, s.buildings.expeditionPost - 1);
}

// ---------- Combat strength ----------

export function weaponsMult(s: GameState): number {
  return 1 + GEAR.weaponsDamagePerLevel * s.gear.weapons;
}

export function armourLossMult(s: GameState): number {
  return Math.max(0, 1 - GEAR.armourLossReductionPerLevel * s.gear.armour);
}

export function guardDamage(s: GameState, jan: Jan): number {
  const barracks = Math.max(1, s.buildings.barracks);
  return (
    GUARDS.damagePerSecond *
    JOBS.guard.growthPerLevel ** (barracks - 1) *
    weaponsMult(s) *
    (jan.hasKit ? 1 : GUARDS.noKitMult)
  );
}
