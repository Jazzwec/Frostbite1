// A New Winter: the thaw at Furnace Lv 10, Warmth Tokens, Veterans and the shop. Rules only; GameEngine exposes them.
import { PRESTIGE, SHOP, VARIANTS } from './balance';
import { neediestJob } from './economy';
import { variantUnlocked } from './events';
import { newWinterState } from './GameEngine';
import type { GameState, Jan, ShopKey, VariantKey } from './types';

export function canThaw(s: GameState): boolean {
  return s.buildings.furnace >= PRESTIGE.thawFurnaceLevel;
}

/** 1 per Furnace level reached plus 1 per 10 Jans in the city. About 14 the first time. */
export function thawTokens(s: GameState): number {
  return s.buildings.furnace * PRESTIGE.tokensPerFurnaceLevel + Math.floor(s.jans.length / PRESTIGE.jansPerToken);
}

export function veteranSlots(s: GameState): number {
  return PRESTIGE.veteranSlots + s.meta.shop.oldFriends;
}

export function shopPrice(key: ShopKey): number {
  return SHOP[key].cost;
}

export function canBuyShop(s: GameState, key: ShopKey): boolean {
  return s.meta.shop[key] < SHOP[key].maxRank && s.meta.tokens >= shopPrice(key);
}

/**
 * Bank this winter's tokens and remember its unlocked variants. Done once, when the thaw screen opens, so the
 * tokens can be spent in the shop before the new winter starts.
 */
export function claimThaw(s: GameState): number {
  if (s.thawed || !canThaw(s)) return 0;
  const earned = thawTokens(s);
  s.meta.tokens += earned;
  for (const v of Object.keys(VARIANTS) as VariantKey[]) {
    if (variantUnlocked(s, v) && !s.meta.unlockedVariants.includes(v)) s.meta.unlockedVariants.push(v);
  }
  s.thawed = true;
  return earned;
}

/**
 * The next winter: everything resets except `meta` (tokens, shop, collection, milestones) and up to veteranSlots
 * chosen Jans, who arrive already rescued as Veterans keeping their variant.
 */
export function startNewWinter(s: GameState, veteranIds: number[]): GameState {
  const meta = s.meta;
  meta.winters++;
  // In the order she picked them, up to the number of slots.
  const chosen = veteranIds
    .map((id) => s.jans.find((j) => j.id === id))
    .filter((j): j is Jan => j !== undefined)
    .slice(0, veteranSlots(s));
  meta.stats.veterans += chosen.filter((j) => !j.veteran).length;
  const next = newWinterState(meta);
  for (const old of chosen) {
    const jan: Jan = { id: next.nextId++, variant: old.variant, job: neediestJob(next), hasKit: false, veteran: true };
    next.jans.push(jan);
  }
  return next;
}
