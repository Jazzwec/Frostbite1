// Every tunable number in the game. Engine logic reads from here and never hard-codes a value.
// [brief] = from docs/design-brief.md. [planned] = decided with Jan while planning the engine (also recorded in the brief).

import type { AnimalKind, BuildingKey, JobKey, ResourceKey, VariantKey } from './types';

/** Fixed simulation step in seconds: 10 ticks per second. [brief] */
export const TICK_SECONDS = 0.1;
/** Most real time advance() will simulate in one call, so a long frame never causes a catch-up burst. [planned] */
export const MAX_ADVANCE_SECONDS = 1;

/** Furnace level bands. Tier 1 = Furnace 1–3, Tier 2 = 4–6, Tier 3 = 7–10. [brief] */
export const TIER_STARTS = [1, 4, 7] as const;

// ---------- New winter ----------

/** A winter starts empty: Meagan rescues the first Jan and gathers the first resources herself. [planned] */
export const START = {
  heat: 0,
  resources: { wood: 0, food: 0, materials: 0, knowledge: 0 } satisfies Record<ResourceKey, number>,
};

// ---------- Heat ----------

export const HEAT = {
  /** Heat cap = Furnace level × this. [brief] */
  capPerFurnaceLevel: 100,
  /** Heat gained per Wood burned. [brief] */
  perWood: 10,
  /** Each Furnace level above 1 makes each Wood give this much more heat (+5%). [planned] */
  burnEfficiencyPerLevel: 0.05,
  /** Drain per second = base + per Jan + per building level (all non-Furnace buildings). [brief] + [planned] */
  drainBase: 0.5,
  drainPerJan: 0.1,
  drainPerBuildingLevel: 0.05,
  /** Hot Springs: drain down this fraction per level (additive). [brief] */
  hotSpringsReductionPerLevel: 0.1,
  /** Below this fraction of the cap, Jan output is multiplied by coldOutputMult. [brief] */
  coldLine: 0.3,
  coldOutputMult: 0.5,
  /** At 0 heat, one Jan wanders off every this many seconds; they return with the next caravan. [brief] */
  leaveEverySeconds: 60,
} as const;

// ---------- Food ----------

export const FOOD = {
  /** Each Jan eats 1 Food per minute. [brief] */
  perJanPerSecond: 1 / 60,
  /** With no Food, Jans work this much slower. [brief] */
  hungryOutputMult: 0.75,
  /** Kitchen: food eaten per Jan down this fraction per level (additive). [brief] */
  kitchenReductionPerLevel: 0.05,
} as const;

// ---------- Storage ----------

export const CAPS = {
  /** Base caps before upgrades. [planned] */
  wood: 300,
  food: 150,
  materials: 100,
  /** Lumber Yard adds this much Wood cap per level. [brief] */
  woodPerLumberLevel: 50,
  /** Storehouse multiplies Wood, Food and Materials caps by this per level (compounding). [planned] */
  storehouseGrowth: 1.25,
} as const;

// ---------- Jans ----------

export const JAN_CAP = {
  /** [brief] */
  perFurnaceLevel: 4,
  perBunkhouseLevel: 2,
} as const;

export const ARRIVALS = {
  /** Seconds between single arrivals when the city is empty. [brief] */
  baseInterval: 60,
  /** Interval × (1 + fillSlowdown × fill²), fill = Jans / cap. 60 s empty → 180 s at the cap. [planned] */
  fillSlowdown: 2,
  /** Most single arrivals waiting at the edge at once. [planned] */
  maxWaiting: 3,
  /** A caravan can push the waiting crowd up to this. [planned] */
  maxWaitingCaravan: 7,
} as const;

export const CARAVAN = {
  /** [planned] */
  firstAt: 600,
  gapMin: 900,
  gapMax: 1500,
  /** 3 to 5 Jans, one guaranteed rare. [brief] */
  minJans: 3,
  maxJans: 5,
  /** Caravan Jans leave if not rescued within this. [brief] */
  waitSeconds: 600,
  /** Signal Beacon: each level multiplies the gap by (1 − this). [planned] */
  beaconSoonerPerLevel: 0.08,
} as const;

/** Lost-His-Keys Jan finds this many seconds of the city's gross output for a random resource. [planned] */
export const KEYS_BONUS = { seconds: 45, minimum: 20, minimumMaterials: 5 } as const;

export interface VariantDef {
  /** Weighted chance on rescue among unlocked variants. */
  weight: number;
  /** Output multiplier per job. */
  jobMult?: Partial<Record<JobKey, number>>;
  /** Multiplier on every job (Sleepy works slower). */
  workMult?: number;
  /** Multiplier on food eaten. */
  foodMult?: number;
  /** Unlocks when this building reaches this level (Furnace level for the tier gates). */
  unlock: { building: BuildingKey; level: number };
}

/** Variant roster and bonuses. [brief] Weights [planned]. DJ and Veteran come later. */
export const VARIANTS: Record<VariantKey, VariantDef> = {
  plain: { weight: 5, unlock: { building: 'furnace', level: 1 } },
  chef: { weight: 1, jobMult: { hunt: 1.25 }, unlock: { building: 'kitchen', level: 1 } },
  sleepy: { weight: 1, workMult: 0.8, foodMult: 0.5, unlock: { building: 'furnace', level: 4 } },
  spreadsheet: { weight: 1, jobMult: { research: 1.25 }, unlock: { building: 'researchHut', level: 1 } },
  keys: { weight: 1, unlock: { building: 'furnace', level: 4 } },
  lumberjack: { weight: 1, jobMult: { chop: 1.25 }, unlock: { building: 'lumberYard', level: 2 } },
};

// ---------- Meagan ----------

export const MEAGAN = {
  /** She gathers automatically while within this distance of the forest or hunting grounds. [planned] */
  gatherRange: 70,
  woodPerSecond: 5,
  foodPerSecond: 3,
  /** Combat. [planned] */
  hp: 100,
  damagePerSecond: 10,
  range: 60,
  /** Walking speed in map units per second (animals 40, guards 60). [planned] */
  walkSpeed: 160,
  /** Most resources she can carry at once, all types together. Upgrades come later. [planned] */
  carryLimit: 20,
} as const;

/** Resources jump between Meagan's bag and a pile or site she walks near. [planned] */
export const MAGNET = {
  /** Reach around a site's drop point. */
  radius: 80,
  /** Units moved per second, deposits and pick-ups together. */
  perSecond: 20,
} as const;

/** The furnace burns only Wood Meagan delivers into it. [planned] */
export const FUEL = {
  /** Wood the furnace holds per Furnace level (3× its heat cap at 10 heat per Wood). */
  capPerFurnaceLevel: 30,
} as const;

/** Pathfinding grid. [planned] */
export const PATH = {
  /** Grid cell size in map units. */
  cellSize: 20,
  /** Meagan's body radius: obstacles are grown by this so she never clips a corner. */
  clearance: 18,
} as const;

// ---------- Jobs ----------

export interface JobDef {
  building: BuildingKey;
  /** Resource produced (scavenging and guarding produce none directly). */
  resource: ResourceKey | null;
  /** Output per Jan per second at building level 1. [brief] */
  baseRate: number;
  /** Rate × this per building level above 1 (compounding). [brief] + [planned] */
  growthPerLevel: number;
}

export const JOBS: Record<JobKey, JobDef> = {
  chop: { building: 'lumberYard', resource: 'wood', baseRate: 1.0, growthPerLevel: 1.15 },
  hunt: { building: 'huntingLodge', resource: 'food', baseRate: 0.6, growthPerLevel: 1.15 },
  build: { building: 'workshop', resource: 'materials', baseRate: 0.1, growthPerLevel: 1.2 },
  research: { building: 'researchHut', resource: 'knowledge', baseRate: 0.05, growthPerLevel: 1.2 },
  scavenge: { building: 'expeditionPost', resource: null, baseRate: 0, growthPerLevel: 1 },
  guard: { building: 'barracks', resource: null, baseRate: 0, growthPerLevel: 1.15 },
};

export const SCAVENGE = {
  /** One burst per Jan every this many seconds at Expedition Post Lv 1. [brief] */
  interval: 90,
  /** Per level above 1: interval × this, burst size × sizeGrowth. [planned] */
  intervalGrowth: 0.92,
  sizeGrowth: 1.2,
  bursts: { wood: 40, food: 25, materials: 8 },
  /** Relative chance of each burst resource. [planned] */
  weights: { wood: 2, food: 1, materials: 1 },
  /** Chance a burst is a cache instead. [planned] */
  cacheChance: 0.05,
  /** A cache is this many Materials bursts… */
  cacheMaterialsMult: 5,
  /** …or, this often, a free level of a random eligible building (never the Furnace). */
  cacheFreeLevelChance: 0.25,
} as const;

// ---------- Buildings ----------

export interface BuildingDef {
  max: number;
  /** Furnace level needed to build it. */
  unlockFurnace: number;
  /** Level at the start of a winter. */
  start: number;
  /** cost(n) = base × growth^n, n = upgrades bought (level − start). [brief] */
  cost: { wood: number; materials: number };
  growth: number;
  /** The first upgrade costs Wood only (Furnace Lv 1→2, before Materials exist). [planned] */
  firstUpgradeWoodOnly?: boolean;
}

export const BUILDINGS: Record<BuildingKey, BuildingDef> = {
  furnace: { max: 10, unlockFurnace: 1, start: 1, cost: { wood: 100, materials: 20 }, growth: 1.8, firstUpgradeWoodOnly: true },
  lumberYard: { max: 25, unlockFurnace: 1, start: 1, cost: { wood: 15, materials: 0 }, growth: 1.12 },
  huntingLodge: { max: 25, unlockFurnace: 1, start: 1, cost: { wood: 15, materials: 0 }, growth: 1.12 },
  storehouse: { max: 15, unlockFurnace: 1, start: 0, cost: { wood: 40, materials: 5 }, growth: 1.15 },
  kitchen: { max: 10, unlockFurnace: 2, start: 0, cost: { wood: 40, materials: 5 }, growth: 1.15 },
  workshop: { max: 20, unlockFurnace: 2, start: 0, cost: { wood: 60, materials: 10 }, growth: 1.15 },
  researchHut: { max: 20, unlockFurnace: 3, start: 0, cost: { wood: 60, materials: 10 }, growth: 1.15 },
  bunkhouse: { max: 10, unlockFurnace: 3, start: 0, cost: { wood: 120, materials: 30 }, growth: 1.25 },
  // Expedition Post has no cost row in the brief; it uses the Bunkhouse class like the prototype.
  expeditionPost: { max: 10, unlockFurnace: 4, start: 0, cost: { wood: 120, materials: 30 }, growth: 1.25 },
  watchtower: { max: 10, unlockFurnace: 4, start: 0, cost: { wood: 120, materials: 30 }, growth: 1.25 },
  hotSprings: { max: 5, unlockFurnace: 7, start: 0, cost: { wood: 120, materials: 30 }, growth: 1.25 },
  barracks: { max: 20, unlockFurnace: 2, start: 0, cost: { wood: 60, materials: 10 }, growth: 1.15 },
  signalBeacon: { max: 10, unlockFurnace: 2, start: 0, cost: { wood: 120, materials: 30 }, growth: 1.25 },
};

// ---------- Blizzards ----------

export const BLIZZARD = {
  /** [brief] */
  drainMult: 3,
  duration: 120,
  longNightDuration: 300,
  warning: 180,
  longNightWarning: 600,
  gapMin: 1200,
  gapMax: 2400,
  /** First blizzard of a winter. [planned] */
  firstAt: 900,
  /** Extra warning per Watchtower level. [planned] */
  watchtowerWarningPerLevel: 60,
} as const;

// ---------- Animal attacks [planned] ----------

export interface AnimalDef {
  hp: number;
  damagePerSecond: number;
  /** Food and Materials dropped when killed. */
  loot: { food: number; materials: number };
  /** Jans scared off for good when it reaches the furnace. */
  scaresAtFurnace: number;
}

export const ANIMALS: Record<AnimalKind, AnimalDef> = {
  wolf: { hp: 20, damagePerSecond: 2, loot: { food: 15, materials: 3 }, scaresAtFurnace: 1 },
  bear: { hp: 80, damagePerSecond: 6, loot: { food: 60, materials: 12 }, scaresAtFurnace: 2 },
  oldBear: { hp: 400, damagePerSecond: 15, loot: { food: 300, materials: 60 }, scaresAtFurnace: 4 },
};

export const ATTACK = {
  /** Attacks begin once the Furnace reaches this level. */
  startFurnaceLevel: 2,
  gapMin: 480,
  gapMax: 900,
  /** Only a Watchtower gives warning: this many seconds per level. */
  watchtowerWarningPerLevel: 15,
  /** Animal HP, damage and loot × this per Furnace level above startFurnaceLevel. */
  strengthGrowth: 1.6,
  wolfPackMin: 2,
  wolfPackMax: 4,
  /** Tier 2: chance an attack adds a bear. Tier 3: always a bear, and this chance of the Old Bear. */
  tier2BearChance: 1 / 3,
  tier3OldBearChance: 0.2,
  /** Movement in map units per second. */
  animalSpeed: 40,
  /** Animals fight anything within this distance and engage defenders within engageRadius. */
  animalRange: 40,
  animalEngageRadius: 60,
  /** Animals detour to a working Jan within this distance; after scareSeconds beside them the Jan flees for good. One per animal. */
  janDetourRadius: 80,
  scareSeconds: 3,
  /** An animal within this distance of the furnace has reached it. */
  furnaceReachRadius: 50,
  /** One-off hit when an animal reaches the furnace. */
  furnaceStealWoodFood: 0.15,
  furnaceStealHeat: 0.2,
  /** Animals spawn this far from the furnace. */
  spawnRadius: 450,
} as const;

export const GUARDS = {
  hp: 30,
  damagePerSecond: 3,
  range: 60,
  speed: 60,
  /** Guards wait on a ring this far from the furnace… */
  ringRadius: 90,
  /** …and move out to engage animals within this distance of the furnace. */
  aggroRadius: 320,
  /** Guards without a kit fight at this fraction of their damage. */
  noKitMult: 0.5,
} as const;

export const GEAR = {
  /** Weapons and Armour are level tracks crafted at the Barracks. */
  cost: { wood: 50, materials: 15 },
  growth: 1.3,
  max: 10,
  /** Weapons: +20% damage per level (guards, Meagan, Watchtower arrows). */
  weaponsDamagePerLevel: 0.2,
  /** Armour: losses (stolen resources and heat, Jans scared at the furnace) −10% per level. */
  armourLossReductionPerLevel: 0.1,
  /** A guard's kit costs this × growth^(Weapons + Armour levels). */
  kitCost: { wood: 20, materials: 5 },
} as const;

export const WATCHTOWER_ARROWS = {
  /** Arrows start at this Watchtower level… */
  fromLevel: 5,
  /** …dealing this many guards' damage, +1 guard per level above fromLevel. */
  baseGuards: 2,
  range: 300,
} as const;
