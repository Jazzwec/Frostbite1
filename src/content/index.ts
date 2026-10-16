// Typed access to the player-facing writing in src/content/*.json.
import type { MilestoneDef } from '../engine/milestones';
import type { BuildingKey, ShopKey, VariantKey } from '../engine/types';
import buildings from './buildings.json';
import chatterLines from './chatter.json';
import jans from './jans.json';
import messages from './messages.json';
import milestones from './milestones.json';
import research from './research.json';
import rescueLines from './rescue_lines.json';
import shop from './shop.json';
import tips from './tips.json';

const BUILDINGS = buildings as Record<BuildingKey, { name: string; effect: string }>;

export function buildingName(key: BuildingKey): string {
  return BUILDINGS[key].name;
}

/** What each level does, for the Build screen. */
export function buildingEffect(key: BuildingKey): string {
  return BUILDINGS[key].effect;
}

const JANS = jans as Record<VariantKey, { name: string; bonus: string; bio: string }>;

export function variantName(v: VariantKey): string {
  return JANS[v].name;
}

export function variantBonus(v: VariantKey): string {
  return JANS[v].bonus;
}

export function variantBio(v: VariantKey): string {
  return JANS[v].bio;
}

const RESEARCH_TEXT = research as Record<string, { name: string; description: string }>;

export function researchName(key: string): string {
  return RESEARCH_TEXT[key]?.name ?? key;
}

export function researchDescription(key: string): string {
  return RESEARCH_TEXT[key]?.description ?? '';
}

// ---------- Milestones ----------

export interface Milestone extends MilestoneDef {
  title: string;
  message: string;
}

export const MILESTONES = milestones as Milestone[];

// ---------- Lines ----------

interface Weighted {
  text: string;
  weight: number;
}

const RESCUE = rescueLines as { main: Weighted[]; variants: Partial<Record<VariantKey, Weighted[]>> };

/** Chance a variant Jan uses one of his own lines rather than the main pool. */
const OWN_VOICE_CHANCE = 0.7;

function pickWeighted(lines: Weighted[], random: () => number): string {
  const total = lines.reduce((a, l) => a + l.weight, 0);
  let x = random() * total;
  for (const l of lines) {
    x -= l.weight;
    if (x <= 0) return l.text;
  }
  return lines[lines.length - 1].text;
}

/** What a Jan says when thawed: his variant's own voice most of the time, else the main pool. */
export function rescueLine(v: VariantKey, random: () => number = Math.random): string {
  const own = RESCUE.variants[v];
  if (own && own.length > 0 && random() < OWN_VOICE_CHANCE) return pickWeighted(own, random);
  return pickWeighted(RESCUE.main, random);
}

function pick<T>(list: T[], random: () => number = Math.random): T {
  return list[Math.floor(random() * list.length)];
}

export const chatterLine = (): string => pick(chatterLines as string[]);
export const tip = (): string => pick(tips as string[]);
export const MESSAGES = messages as {
  blizzardWarnings: string[];
  longNightWarning: string;
  blizzardStart: string;
  longNightStart: string;
  blizzardEnd: string;
  thaw: string[];
  firstPrestige: string;
  welcomeBack: string;
};
export const blizzardWarningLine = (): string => pick(MESSAGES.blizzardWarnings);

const SHOP_TEXT = shop as Record<ShopKey, { name: string; description: string }>;

export function shopName(key: ShopKey): string {
  return SHOP_TEXT[key].name;
}

export function shopDescription(key: ShopKey): string {
  return SHOP_TEXT[key].description;
}
