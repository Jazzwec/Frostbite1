// Animal attacks: scheduling, spawning, movement, autofighting, outcomes and loot.
import { ANIMALS, ATTACK, GUARDS, MEAGAN, WATCHTOWER_ARROWS } from './balance';
import { armourLossMult, guardDamage, tierOf, weaponsMult } from './economy';
import { addCapped, type TickContext } from './events';
import { FURNACE, distance, jobSite, moveTowards, siteOf } from './map';
import { between, intBetween, type Rng } from './rng';
import type { Animal, AnimalKind, GameState, GuardUnit, Point } from './types';

export function attackWarning(s: GameState): number {
  return ATTACK.watchtowerWarningPerLevel * s.buildings.watchtower;
}

export function strengthScale(s: GameState): number {
  return ATTACK.strengthGrowth ** Math.max(0, s.buildings.furnace - ATTACK.startFurnaceLevel);
}

export function scheduleAttack(s: GameState, rng: Rng): void {
  s.attack.next = s.t + between(rng, ATTACK.gapMin, ATTACK.gapMax);
  s.attack.warned = false;
}

/** Which animals come, by tier. */
export function rollAttack(s: GameState, rng: Rng): AnimalKind[] {
  const tier = tierOf(s.buildings.furnace);
  const kinds: AnimalKind[] = [];
  if (tier >= 3 && rng() < ATTACK.tier3OldBearChance) kinds.push('oldBear');
  if (tier >= 3 || (tier === 2 && rng() < ATTACK.tier2BearChance)) kinds.push('bear');
  const wolves = intBetween(rng, ATTACK.wolfPackMin, ATTACK.wolfPackMax);
  for (let i = 0; i < wolves; i++) kinds.push('wolf');
  return kinds;
}

function startAttack(s: GameState, ctx: TickContext): void {
  const scale = strengthScale(s);
  const angle = ctx.rng() * Math.PI * 2;
  const kinds = rollAttack(s, ctx.rng);
  s.attack.animals = kinds.map((kind, i) => {
    const a = angle + (i - (kinds.length - 1) / 2) * 0.08; // fanned out a little
    const def = ANIMALS[kind];
    return {
      id: s.nextId++,
      kind,
      x: Math.cos(a) * ATTACK.spawnRadius,
      y: Math.sin(a) * ATTACK.spawnRadius,
      hp: def.hp * scale,
      maxHp: def.hp * scale,
      damagePerSecond: def.damagePerSecond * scale,
      targetJanId: null,
      scareProgress: 0,
      hasScared: false,
    };
  });
  s.attack.active = true;
  s.attack.warned = true;
  s.attack.breached = false;
  ctx.emit({ type: 'attackStart', animals: kinds.length });
}

function endAttack(s: GameState, ctx: TickContext): void {
  const repelled = !s.attack.breached;
  if (repelled) s.stats.attacksRepelled++;
  s.attack.active = false;
  s.attack.animals = [];
  s.attack.guards = [];
  s.meagan.hp = MEAGAN.hp;
  s.meagan.injured = false;
  ctx.emit({ type: 'attackEnd', repelled });
  scheduleAttack(s, ctx.rng);
}

function ringSpot(index: number, count: number): Point {
  const a = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: FURNACE.x + Math.cos(a) * GUARDS.ringRadius, y: FURNACE.y + Math.sin(a) * GUARDS.ringRadius };
}

/** Keep the guard units in step with the Jans currently on guard duty. */
function syncGuards(s: GameState): GuardUnit[] {
  const onDuty = s.jans.filter((j) => j.job === 'guard');
  const ids = new Set(onDuty.map((j) => j.id));
  s.attack.guards = s.attack.guards.filter((g) => ids.has(g.janId));
  onDuty.forEach((j, i) => {
    if (!s.attack.guards.some((g) => g.janId === j.id)) {
      const spot = ringSpot(i, onDuty.length);
      s.attack.guards.push({ janId: j.id, x: spot.x, y: spot.y, hp: GUARDS.hp, knockedOut: false });
    }
  });
  return s.attack.guards;
}

function nearestAnimal(animals: Animal[], p: Point, within: number): Animal | null {
  let best: Animal | null = null;
  let bestD = within;
  for (const a of animals) {
    const d = distance(a, p);
    if (a.hp > 0 && d <= bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

type Defender = { kind: 'guard'; unit: GuardUnit } | { kind: 'meagan' };

function defenderPos(s: GameState, d: Defender): Point {
  return d.kind === 'guard' ? d.unit : s.meagan;
}

function nearestDefender(s: GameState, p: Point, within: number): Defender | null {
  let best: Defender | null = null;
  let bestD = within;
  for (const g of s.attack.guards) {
    const d = distance(g, p);
    if (!g.knockedOut && d <= bestD) {
      best = { kind: 'guard', unit: g };
      bestD = d;
    }
  }
  if (!s.meagan.injured && distance(s.meagan, p) <= bestD) best = { kind: 'meagan' };
  return best;
}

function jobSiteOf(s: GameState, janId: number): Point | null {
  const jan = s.jans.find((j) => j.id === janId);
  if (!jan || jan.job === 'idle' || jan.job === 'guard') return null;
  return jobSite(s, jan.job);
}

export function updateAttacks(s: GameState, dt: number, ctx: TickContext): void {
  const at = s.attack;
  if (!at.active) {
    if (s.buildings.furnace < ATTACK.startFurnaceLevel) return;
    if (at.next === Infinity) scheduleAttack(s, ctx.rng);
    const warn = attackWarning(s);
    if (!at.warned && warn > 0 && s.t >= at.next - warn && !s.blizzard.active) {
      at.warned = true;
      ctx.emit({ type: 'attackWarn', startsIn: Math.max(0, at.next - s.t) });
    }
    // Never during a blizzard: the attack waits until the snow clears.
    if (s.t >= at.next && !s.blizzard.active) startAttack(s, ctx);
    return;
  }

  const guards = syncGuards(s);
  const weapons = weaponsMult(s);

  // Defenders strike first.
  for (const g of guards) {
    if (g.knockedOut) continue;
    const jan = s.jans.find((j) => j.id === g.janId)!;
    const target = nearestAnimal(at.animals, FURNACE, GUARDS.aggroRadius);
    if (!target) {
      const idx = guards.indexOf(g);
      moveTowards(g, ringSpot(idx, guards.length), GUARDS.speed * dt);
      continue;
    }
    if (distance(g, target) > GUARDS.range) moveTowards(g, target, GUARDS.speed * dt);
    if (distance(g, target) <= GUARDS.range) target.hp -= guardDamage(s, jan) * dt;
  }

  if (!s.meagan.injured) {
    const target = nearestAnimal(at.animals, s.meagan, MEAGAN.range);
    if (target) target.hp -= MEAGAN.damagePerSecond * weapons * dt;
  }

  const tower = s.buildings.watchtower;
  if (tower >= WATCHTOWER_ARROWS.fromLevel) {
    const target = nearestAnimal(at.animals, siteOf(s, 'watchtower') ?? FURNACE, WATCHTOWER_ARROWS.range);
    if (target) {
      const guardsWorth = WATCHTOWER_ARROWS.baseGuards + (tower - WATCHTOWER_ARROWS.fromLevel);
      target.hp -= guardsWorth * guardDamageBase(s) * weapons * dt;
    }
  }

  // Remove the dead and drop their loot.
  const scale = strengthScale(s);
  at.animals = at.animals.filter((a) => {
    if (a.hp > 0) return true;
    const loot = ANIMALS[a.kind].loot;
    const food = loot.food * scale;
    const materials = loot.materials * scale;
    addCapped(s, 'food', food);
    addCapped(s, 'materials', materials);
    ctx.emit({ type: 'animalKilled', kind: a.kind, food, materials, at: { x: a.x, y: a.y } });
    return false;
  });

  // Animals act.
  at.animals = at.animals.filter((a) => animalStep(s, a, dt, ctx));

  if (at.animals.length === 0) endAttack(s, ctx);
}

/** Barracks-boosted guard damage without kit or weapons, used for Watchtower arrows. */
function guardDamageBase(s: GameState): number {
  return guardDamage(s, { id: -1, variant: 'plain', job: 'guard', hasKit: true }) / weaponsMult(s);
}

/** Move/fight one animal. Returns false when it leaves the map (after hitting the furnace). */
function animalStep(s: GameState, a: Animal, dt: number, ctx: TickContext): boolean {
  // Fight any defender close enough.
  const foe = nearestDefender(s, a, ATTACK.animalEngageRadius);
  if (foe) {
    const pos = defenderPos(s, foe);
    if (distance(a, pos) > ATTACK.animalRange) moveTowards(a, pos, ATTACK.animalSpeed * dt);
    else hitDefender(s, foe, a.damagePerSecond * dt, ctx);
    return true;
  }

  // Detour to scare one working Jan.
  if (!a.hasScared && a.targetJanId === null) {
    const nearby = s.jans.filter((j) => {
      const site = jobSiteOf(s, j.id);
      return site !== null && distance(a, site) <= ATTACK.janDetourRadius;
    });
    if (nearby.length > 0) a.targetJanId = nearby[Math.floor(ctx.rng() * nearby.length)].id;
  }
  if (a.targetJanId !== null) {
    const site = jobSiteOf(s, a.targetJanId);
    if (!site) {
      a.targetJanId = null; // reassigned or gone
      a.scareProgress = 0;
    } else if (distance(a, site) > ATTACK.animalRange) {
      moveTowards(a, site, ATTACK.animalSpeed * dt);
    } else {
      a.scareProgress += dt;
      if (a.scareProgress >= ATTACK.scareSeconds) {
        const i = s.jans.findIndex((j) => j.id === a.targetJanId);
        const [jan] = s.jans.splice(i, 1);
        ctx.emit({ type: 'janScared', jan, at: { x: a.x, y: a.y } });
        a.targetJanId = null;
        a.hasScared = true;
      }
    }
    return true;
  }

  // Head for the furnace.
  moveTowards(a, FURNACE, ATTACK.animalSpeed * dt);
  if (distance(a, FURNACE) <= ATTACK.furnaceReachRadius) {
    hitFurnace(s, a, ctx);
    return false;
  }
  return true;
}

function hitDefender(s: GameState, foe: Defender, damage: number, ctx: TickContext): void {
  if (foe.kind === 'meagan') {
    s.meagan.hp -= damage;
    if (s.meagan.hp <= 0) {
      s.meagan.hp = 0;
      s.meagan.injured = true;
      ctx.emit({ type: 'meaganInjured' });
    }
    return;
  }
  foe.unit.hp -= damage;
  if (foe.unit.hp <= 0) {
    foe.unit.hp = 0;
    foe.unit.knockedOut = true;
    ctx.emit({ type: 'guardKnockedOut', janId: foe.unit.janId });
  }
}

/** One-off hit on arrival at the furnace; Armour softens it. */
function hitFurnace(s: GameState, a: Animal, ctx: TickContext): void {
  const loss = armourLossMult(s);
  const wood = s.resources.wood * ATTACK.furnaceStealWoodFood * loss;
  const food = s.resources.food * ATTACK.furnaceStealWoodFood * loss;
  const heat = s.heat * ATTACK.furnaceStealHeat * loss;
  s.resources.wood -= wood;
  s.resources.food -= food;
  s.heat -= heat;
  const jansLost = Math.min(s.jans.length, Math.round(ANIMALS[a.kind].scaresAtFurnace * loss));
  for (let i = 0; i < jansLost; i++) s.jans.splice(Math.floor(ctx.rng() * s.jans.length), 1);
  s.attack.breached = true;
  ctx.emit({ type: 'furnaceHit', kind: a.kind, wood, food, heat, jansLost });
}
