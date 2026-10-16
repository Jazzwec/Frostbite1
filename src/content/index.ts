// Typed access to the player-facing writing in src/content/*.json.
import type { BuildingKey, VariantKey } from '../engine/types';
import buildings from './buildings.json';
import jans from './jans.json';
import research from './research.json';

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
