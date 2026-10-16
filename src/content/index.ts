// Typed access to the player-facing writing in src/content/*.json.
import type { BuildingKey, VariantKey } from '../engine/types';
import buildings from './buildings.json';
import jans from './jans.json';

const BUILDINGS = buildings as Record<BuildingKey, { name: string; effect: string }>;

export function buildingName(key: BuildingKey): string {
  return BUILDINGS[key].name;
}

/** What each level does, for the Build screen. */
export function buildingEffect(key: BuildingKey): string {
  return BUILDINGS[key].effect;
}

const JANS = jans as Record<VariantKey, { name: string; bonus: string }>;

export function variantName(v: VariantKey): string {
  return JANS[v].name;
}

export function variantBonus(v: VariantKey): string {
  return JANS[v].bonus;
}
