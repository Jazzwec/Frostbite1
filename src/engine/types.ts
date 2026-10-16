export type ResourceKey = 'wood' | 'food' | 'materials' | 'knowledge';
export type StoredResource = Exclude<ResourceKey, 'knowledge'>;

export type BuildingKey =
  | 'furnace'
  | 'lumberYard'
  | 'huntingLodge'
  | 'storehouse'
  | 'kitchen'
  | 'workshop'
  | 'researchHut'
  | 'bunkhouse'
  | 'expeditionPost'
  | 'watchtower'
  | 'hotSprings'
  | 'barracks'
  | 'signalBeacon';

export type JobKey = 'chop' | 'hunt' | 'build' | 'research' | 'scavenge' | 'guard';
export type Assignment = JobKey | 'idle';

export type VariantKey = 'plain' | 'chef' | 'sleepy' | 'spreadsheet' | 'keys' | 'lumberjack';

export type GearKey = 'weapons' | 'armour';

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rectangle in map units; (x, y) is the top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Jan {
  id: number;
  variant: VariantKey;
  job: Assignment;
  /** Guards fight at full strength only with a kit. */
  hasKit: boolean;
}

/** A Jan waiting at the map edge to be rescued. */
export interface Arrival {
  id: number;
  /** Fixed for caravan rares and returning Jans; otherwise rolled on rescue. */
  variant: VariantKey | null;
  fromCaravan: boolean;
  /** A Jan who wandered off in the cold and came back: not a new rescue. */
  returning: boolean;
  /** Caravan Jans leave at this time if not rescued. */
  leavesAt: number | null;
}

export type AnimalKind = 'wolf' | 'bear' | 'oldBear';

export interface Animal {
  id: number;
  kind: AnimalKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damagePerSecond: number;
  /** Jan this animal is detouring to scare, and how long it has stood beside them. */
  targetJanId: number | null;
  scareProgress: number;
  /** Each animal scares at most one working Jan on the way in. */
  hasScared: boolean;
}

export interface GuardUnit {
  janId: number;
  x: number;
  y: number;
  hp: number;
  knockedOut: boolean;
}

export interface Meagan extends Point {
  hp: number;
  /** Injured Meagan can't move or gather until the attack ends. */
  injured: boolean;
  /** Waypoints still to walk, nearest first. */
  path: Point[];
  /** Resources she is carrying. */
  bag: Record<StoredResource, number>;
  /** The site she was sent to; its action runs when she arrives. */
  goal: { kind: 'site'; site: number } | null;
}

/** One building spot on the map (see SITES in map.ts). */
export interface SiteState {
  /** null = an empty plot. */
  building: BuildingKey | null;
  /** Accepting deliveries towards its next level (always true while under construction). */
  upgrading: boolean;
  /** Resources delivered towards the next level. */
  progress: Partial<Record<StoredResource, number>>;
}

export interface BlizzardState {
  next: number;
  active: boolean;
  end: number;
  long: boolean;
  warned: boolean;
}

export interface AttackState {
  /** Start time of the next attack; Infinity until attacks unlock. */
  next: number;
  warned: boolean;
  active: boolean;
  animals: Animal[];
  guards: GuardUnit[];
  /** Did any animal reach the furnace in the current attack? */
  breached: boolean;
}

export interface GameState {
  /** Active play time in seconds. */
  t: number;
  heat: number;
  resources: Record<ResourceKey, number>;
  buildings: Record<BuildingKey, number>;
  gear: Record<GearKey, number>;
  jans: Jan[];
  waiting: Arrival[];
  /** Variants of Jans who wandered off in the cold; they return with the next caravan. */
  wanderedOff: VariantKey[];
  meagan: Meagan;
  /** Wood Meagan has delivered into the furnace, burned to make heat. */
  fuel: number;
  /** Aligned with SITES in map.ts. */
  sites: SiteState[];
  nextId: number;
  arrivalTimer: number;
  caravanNext: number;
  leaveTimer: number;
  /** Fractional progress towards the next scavenging burst. */
  scavengeProgress: number;
  blizzard: BlizzardState;
  /** Highest tier that has already had its Long Night. */
  longNightTier: number;
  attack: AttackState;
  /** Last second's Wood burned per second, for display. */
  burnRate: number;
}

export type EngineEvent =
  | { type: 'blizzardWarn'; long: boolean; startsIn: number }
  | { type: 'blizzardStart'; long: boolean }
  | { type: 'blizzardEnd'; long: boolean }
  | { type: 'arrival'; id: number }
  | { type: 'caravan'; count: number }
  | { type: 'caravanLeft'; count: number }
  | { type: 'rescued'; jan: Jan; returning: boolean }
  | { type: 'keysBonus'; resource: ResourceKey; amount: number }
  | { type: 'burst'; resource: ResourceKey; amount: number }
  | { type: 'cache'; resource: 'materials'; amount: number }
  | { type: 'cacheLevel'; building: BuildingKey }
  | { type: 'janWanderedOff'; jan: Jan }
  | { type: 'attackWarn'; startsIn: number }
  | { type: 'attackStart'; animals: number }
  | { type: 'attackEnd'; repelled: boolean }
  | { type: 'animalKilled'; kind: AnimalKind; food: number; materials: number }
  | { type: 'janScared'; jan: Jan }
  | { type: 'furnaceHit'; kind: AnimalKind; wood: number; food: number; heat: number; jansLost: number }
  | { type: 'meaganInjured' }
  | { type: 'guardKnockedOut'; janId: number }
  | { type: 'plotReached'; site: number }
  | { type: 'upgradeStarted'; site: number; building: BuildingKey }
  | { type: 'buildingUpgraded'; site: number; building: BuildingKey; level: number };
