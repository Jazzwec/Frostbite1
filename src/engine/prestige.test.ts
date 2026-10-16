import { describe, expect, it } from 'vitest';
import { PRESTIGE, SHOP, WARM_START } from './balance';
import { arrivalInterval, caps, heatDrain, jobRate } from './economy';
import { variantUnlocked } from './events';
import { GameEngine } from './GameEngine';
import { canThaw, thawTokens, veteranSlots } from './prestige';
import { deserialize, serialize } from './save';
import type { Jan, VariantKey } from './types';

function addJans(e: GameEngine, n: number, variant: VariantKey = 'plain', job: Jan['job'] = 'chop'): void {
  for (let i = 0; i < n; i++) e.state.jans.push({ id: 1000 + e.state.jans.length, variant, job, hasKit: false });
}

/** A city at the thaw: Furnace Lv 10, 40 Jans, some progress to lose. */
function atThaw(): GameEngine {
  const e = new GameEngine({ seed: 1 });
  e.state.buildings.furnace = 10;
  e.state.buildings.kitchen = 3;
  e.state.resources.wood = 500;
  e.state.research.push('sharpAxes');
  addJans(e, 39);
  addJans(e, 1, 'chef');
  e.state.meta.found.chef = 1;
  e.markMilestone('firstJan');
  return e;
}

describe('the thaw', () => {
  it('arrives at Furnace Lv 10 and pays about 14 tokens the first time', () => {
    const e = atThaw();
    expect(canThaw(e.state)).toBe(true);
    expect(thawTokens(e.state)).toBe(10 + 4);
    e.state.buildings.furnace = PRESTIGE.thawFurnaceLevel - 1;
    expect(canThaw(e.state)).toBe(false);
    expect(e.claimThaw()).toBe(0);
  });

  it('banks the tokens once and remembers unlocked variants', () => {
    const e = atThaw();
    expect(e.claimThaw()).toBe(14);
    expect(e.claimThaw()).toBe(0);
    expect(e.state.meta.tokens).toBe(14);
    expect(e.state.meta.unlockedVariants).toContain('chef');
  });

  it('refuses a new winter before the tokens are claimed', () => {
    const e = atThaw();
    expect(e.startNewWinter([])).toBe(false);
  });

  it('resets the city but keeps tokens, the collection, milestones and up to 3 Veterans', () => {
    const e = atThaw();
    e.claimThaw();
    const chef = e.state.jans.find((j) => j.variant === 'chef')!;
    const ids = [chef.id, ...e.state.jans.slice(0, 4).map((j) => j.id)];
    expect(e.startNewWinter(ids)).toBe(true);
    const s = e.state;
    expect(s.buildings.furnace).toBe(1);
    expect(s.buildings.kitchen).toBe(0);
    expect(s.resources.wood).toBe(0);
    expect(s.research).toEqual([]);
    expect(s.thawed).toBe(false);
    expect(s.meta).toMatchObject({ tokens: 14, winters: 1 });
    expect(s.meta.found.chef).toBe(1);
    expect(s.meta.milestones).toContain('firstJan');
    expect(s.jans).toHaveLength(PRESTIGE.veteranSlots);
    expect(s.jans.every((j) => j.veteran)).toBe(true);
    expect(s.jans.some((j) => j.variant === 'chef')).toBe(true);
    expect(s.meta.stats.veterans).toBe(3);
  });

  it('keeps variant unlocks into the next winter', () => {
    const e = atThaw();
    e.claimThaw();
    e.startNewWinter([]);
    expect(e.state.buildings.kitchen).toBe(0);
    expect(variantUnlocked(e.state, 'chef')).toBe(true);
    expect(variantUnlocked(e.state, 'dj')).toBe(true); // Furnace Lv 10 had unlocked Tier 3
    expect(variantUnlocked(e.state, 'spreadsheet')).toBe(false); // never had a Research Hut
  });

  it('lets Veterans add 5% to all output each', () => {
    const e = new GameEngine({ seed: 1 });
    addJans(e, 2);
    const before = jobRate(e.state, 'chop');
    e.state.jans[0].veteran = true;
    expect(jobRate(e.state, 'chop')).toBeCloseTo(before * 1.05);
  });
});

describe('Warmth Token shop', () => {
  function withTokens(n: number): GameEngine {
    const e = new GameEngine({ seed: 1 });
    e.state.meta.tokens = n;
    return e;
  }

  it('costs tokens per rank and stops at the max rank', () => {
    const e = withTokens(100);
    expect(e.buyShop('warmStart')).toBe(true);
    expect(e.state.meta.tokens).toBe(100 - SHOP.warmStart.cost);
    expect(e.buyShop('warmStart')).toBe(false); // one rank only
    const poor = withTokens(3);
    expect(poor.buyShop('headStart')).toBe(false);
  });

  it('Warm start: the next winter begins at Furnace Lv 2 with Wood in the furnace', () => {
    const e = atThaw();
    e.claimThaw();
    e.buyShop('warmStart');
    e.startNewWinter([]);
    expect(e.state.buildings.furnace).toBe(WARM_START.furnaceLevel);
    expect(e.state.fuel).toBe(WARM_START.fuel);
  });

  it('Thick walls, Fast feet, Deep pockets and Head start change their rules per rank', () => {
    const e = withTokens(100);
    addJans(e, 3);
    const drain = heatDrain(e.state);
    const arrival = arrivalInterval(e.state);
    const wood = caps(e.state).wood;
    const chop = jobRate(e.state, 'chop');
    e.buyShop('thickWalls');
    e.buyShop('thickWalls');
    e.buyShop('fastFeet');
    e.buyShop('deepPockets');
    e.buyShop('headStart');
    expect(heatDrain(e.state)).toBeCloseTo(drain * 0.9);
    expect(arrivalInterval(e.state)).toBeCloseTo(arrival * 0.9);
    expect(caps(e.state).wood).toBeCloseTo(wood * 1.25);
    expect(jobRate(e.state, 'chop')).toBeCloseTo(chop * 1.1);
  });

  it('Old friends adds a Veteran slot per rank', () => {
    const e = withTokens(100);
    e.buyShop('oldFriends');
    expect(veteranSlots(e.state)).toBe(PRESTIGE.veteranSlots + 1);
  });
});

describe('DJ Jan', () => {
  it('adds 5% to every job per DJ, counting at most 3', () => {
    const e = new GameEngine({ seed: 1 });
    addJans(e, 1);
    const base = jobRate(e.state, 'chop');
    addJans(e, 1, 'dj', 'idle');
    expect(jobRate(e.state, 'chop')).toBeCloseTo(base * 1.05);
    addJans(e, 4, 'dj', 'idle');
    expect(jobRate(e.state, 'chop')).toBeCloseTo(base * 1.15);
  });
});

describe('saves', () => {
  it('carry the meta, and older saves move their collection into it', () => {
    const e = atThaw();
    e.claimThaw();
    expect(deserialize(serialize(e.state))!.state.meta).toEqual(e.state.meta);

    const raw = JSON.parse(serialize(e.state));
    const meta = raw.state.meta;
    delete raw.state.meta;
    raw.state.found = meta.found;
    raw.state.milestones = meta.milestones;
    raw.state.stats = { rescued: 7, blizzardsSurvived: 1, attacksRepelled: 0 };
    const old = deserialize(JSON.stringify(raw))!.state;
    expect(old.meta.found.chef).toBe(1);
    expect(old.meta.milestones).toContain('firstJan');
    expect(old.meta.stats).toEqual({ rescued: 7, blizzardsSurvived: 1, attacksRepelled: 0, veterans: 0 });
    expect(old.meta.tokens).toBe(0);
    expect('found' in old).toBe(false);
  });
});
